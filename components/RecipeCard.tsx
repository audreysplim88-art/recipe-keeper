"use client";

import { Recipe, Ingredient, Tip, RecipeCategory, CATEGORY_META, CATEGORY_ORDER } from "@/lib/types";
import { useState, useMemo } from "react";

interface RecipeCardProps {
  recipe: Recipe;
  onDelete?: () => void;
  onSave?: (updated: Recipe) => void;
}

const tipCategoryLabel: Record<Tip["category"], string> = {
  tip: "Tip",
  trick: "Trick",
  secret: "Secret",
  note: "Note",
};

const tipCategoryIcon: Record<Tip["category"], string> = {
  tip: "💡",
  trick: "✨",
  secret: "🤫",
  note: "📝",
};

// Reusable inline styles for edit inputs
const inputCls = "w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400";
const textareaCls = "w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none";

// ─── Serving size calculator helpers ────────────────────────────────────────

/** Extract the first number from a servings string e.g. "4 servings" → 4, "6-8 people" → 6 */
function parseServings(servings: string): number | null {
  const match = servings.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return isNaN(n) || n <= 0 ? null : n;
}

/** Parse an amount string to a decimal number. Returns null if not numeric. */
function parseAmount(amount: string): number | null {
  const trimmed = amount.trim();

  // Mixed number: "2 1/2"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);

  // Simple fraction: "1/2"
  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const den = parseInt(fraction[2]);
    if (den === 0) return null;
    return parseInt(fraction[1]) / den;
  }

  // Plain integer or decimal: "3", "1.5"
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/** Convert a decimal back to a readable amount string using nice fractions. */
function formatAmount(value: number): string {
  if (value <= 0) return "0";

  // Common fractions as [numerator, denominator, display]
  const FRACTIONS: [number, number, string][] = [
    [1, 8, "1/8"], [1, 4, "1/4"], [1, 3, "1/3"], [3, 8, "3/8"],
    [1, 2, "1/2"], [5, 8, "5/8"], [2, 3, "2/3"], [3, 4, "3/4"], [7, 8, "7/8"],
  ];

  const whole = Math.floor(value);
  const decimal = value - whole;

  // Close enough to a whole number
  if (decimal < 0.05) return String(whole === 0 ? Math.round(value) : whole);
  if (decimal > 0.95) return String(whole + 1);

  // Find the closest common fraction
  let bestLabel = "";
  let bestError = Infinity;
  for (const [num, den, label] of FRACTIONS) {
    const error = Math.abs(decimal - num / den);
    if (error < bestError) {
      bestError = error;
      bestLabel = label;
    }
  }

  if (bestError < 0.07 && bestLabel) {
    return whole > 0 ? `${whole} ${bestLabel}` : bestLabel;
  }

  // Fall back to one decimal place
  return value.toFixed(1).replace(/\.0$/, "");
}

/** Scale an amount string by a multiplier. Returns { scaled, wasScaled }. */
function scaleAmount(amount: string, multiplier: number): { display: string; scaled: boolean } {
  if (multiplier === 1) return { display: amount, scaled: false };
  const parsed = parseAmount(amount);
  if (parsed === null) return { display: amount, scaled: false };
  return { display: formatAmount(parsed * multiplier), scaled: true };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecipeCard({ recipe, onDelete, onSave }: RecipeCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Recipe>(recipe);

  // Serving size calculator
  // originalServings is the parsed number from the recipe's servings string (may be null if unparseable)
  // baseServings is locked at mount and used as the ×1 reference for scaling
  const originalServings = useMemo(() => parseServings(recipe.servings), [recipe.servings]);
  const DEFAULT_SERVINGS = 4;
  const [baseServings, setBaseServings] = useState<number>(originalServings ?? DEFAULT_SERVINGS);
  const [scaledServings, setScaledServings] = useState<number>(originalServings ?? DEFAULT_SERVINGS);
  const isScaled = scaledServings !== baseServings;
  const scalingMultiplier = baseServings > 0 ? scaledServings / baseServings : 1;

  const adjustServings = (delta: number) => {
    setScaledServings((prev) => Math.max(1, prev + delta));
  };
  const resetServings = () => setScaledServings(baseServings);

  // Edit mode helpers
  const startEditing = () => {
    setDraft({ ...recipe });
    setIsEditing(true);
    setShowDeleteConfirm(false);
  };
  const cancelEditing = () => {
    setDraft({ ...recipe });
    setIsEditing(false);
  };
  const saveEditing = () => {
    const updated = { ...draft, updatedAt: new Date().toISOString() };
    onSave?.(updated);
    setIsEditing(false);
    // If the servings text changed, reset the calculator to the new base value
    const newBase = parseServings(draft.servings);
    if (newBase !== null && newBase !== baseServings) {
      setBaseServings(newBase);
      setScaledServings(newBase);
    }
  };

  // Ingredient helpers
  const updateIngredient = (i: number, field: keyof Ingredient, value: string) => {
    const updated = draft.ingredients.map((ing, idx) =>
      idx === i ? { ...ing, [field]: value } : ing
    );
    setDraft({ ...draft, ingredients: updated });
  };
  const removeIngredient = (i: number) =>
    setDraft({ ...draft, ingredients: draft.ingredients.filter((_, idx) => idx !== i) });
  const addIngredient = () =>
    setDraft({ ...draft, ingredients: [...draft.ingredients, { amount: "", unit: "", name: "", notes: "" }] });

  // Instruction helpers
  const updateInstruction = (i: number, value: string) => {
    const updated = draft.instructions.map((s, idx) => (idx === i ? value : s));
    setDraft({ ...draft, instructions: updated });
  };
  const removeInstruction = (i: number) =>
    setDraft({ ...draft, instructions: draft.instructions.filter((_, idx) => idx !== i) });
  const addInstruction = () =>
    setDraft({ ...draft, instructions: [...draft.instructions, ""] });

  // Tip helpers
  const updateTip = (i: number, field: keyof Tip, value: string) => {
    const updated = draft.tips.map((t, idx) =>
      idx === i ? { ...t, [field]: value } : t
    );
    setDraft({ ...draft, tips: updated });
  };
  const removeTip = (i: number) =>
    setDraft({ ...draft, tips: draft.tips.filter((_, idx) => idx !== i) });
  const addTip = () =>
    setDraft({ ...draft, tips: [...draft.tips, { category: "tip", content: "" }] });

  const display = isEditing ? draft : recipe;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-amber-700 text-white rounded-t-2xl p-8">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  className={`${inputCls} text-stone-800 font-bold text-lg font-serif`}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Recipe title"
                />
                <textarea
                  className={`${textareaCls} text-stone-700`}
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Description"
                />
                {/* Category selector */}
                <select
                  className={`${inputCls} text-stone-700`}
                  value={draft.category ?? "other"}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as RecipeCategory })}
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].emoji} {CATEGORY_META[cat].label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                {display.category && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-200 border border-amber-400/50 rounded-full px-2.5 py-0.5 mb-3">
                    {CATEGORY_META[display.category].emoji} {CATEGORY_META[display.category].label}
                  </span>
                )}
                <h1 className="text-3xl font-bold mb-2 font-serif">{display.title}</h1>
                <p className="text-amber-100 text-lg leading-relaxed">{display.description}</p>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={saveEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                >
                  ✓ Save
                </button>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm transition-colors"
                >
                  ✗ Cancel
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                {onSave && (
                  <button
                    onClick={startEditing}
                    className="text-amber-300 hover:text-white transition-colors"
                    title="Edit recipe"
                  >
                    ✏️
                  </button>
                )}
                {onDelete && (
                  <>
                    {showDeleteConfirm ? (
                      <div className="flex flex-col gap-2 items-end">
                        <p className="text-amber-200 text-sm">Delete this recipe?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={onDelete}
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-amber-300 hover:text-white transition-colors"
                        title="Delete recipe"
                      >
                        🗑
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 mt-6">
          {isEditing ? (
            <>
              <label className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                <span>🍽</span>
                <input
                  className="bg-transparent text-white placeholder-amber-300 text-sm font-medium w-24 focus:outline-none border-b border-amber-400"
                  value={draft.servings}
                  onChange={(e) => setDraft({ ...draft, servings: e.target.value })}
                  placeholder="Servings"
                />
              </label>
              <label className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                <span>⏱</span>
                <input
                  className="bg-transparent text-white placeholder-amber-300 text-sm font-medium w-24 focus:outline-none border-b border-amber-400"
                  value={draft.prepTime}
                  onChange={(e) => setDraft({ ...draft, prepTime: e.target.value })}
                  placeholder="Prep time"
                />
              </label>
              <label className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                <span>🔥</span>
                <input
                  className="bg-transparent text-white placeholder-amber-300 text-sm font-medium w-24 focus:outline-none border-b border-amber-400"
                  value={draft.cookTime}
                  onChange={(e) => setDraft({ ...draft, cookTime: e.target.value })}
                  placeholder="Cook time"
                />
              </label>
            </>
          ) : (
            <>
              {display.servings && (
                <div className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                  <span>🍽</span>
                  <span className="text-sm font-medium">{display.servings}</span>
                </div>
              )}
              {display.prepTime && (
                <div className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                  <span>⏱</span>
                  <span className="text-sm font-medium">Prep: {display.prepTime}</span>
                </div>
              )}
              {display.cookTime && (
                <div className="flex items-center gap-2 bg-amber-800/50 rounded-lg px-3 py-1.5">
                  <span>🔥</span>
                  <span className="text-sm font-medium">Cook: {display.cookTime}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-b-2xl shadow-xl overflow-hidden">
        <div className="grid md:grid-cols-5 gap-0">
          {/* Ingredients */}
          <div className="md:col-span-2 bg-stone-50 p-6 border-r border-stone-100">

            {/* Ingredients header + serving calculator */}
            <div className="flex items-center justify-between mb-4 gap-2">
              <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2 shrink-0">
                <span>🧄</span> Ingredients
              </h2>
              {!isEditing && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustServings(-1)}
                    disabled={scaledServings <= 1}
                    className="w-6 h-6 rounded-full bg-amber-100 hover:bg-amber-200 disabled:opacity-30 disabled:cursor-not-allowed text-amber-800 font-bold text-sm flex items-center justify-center transition-colors"
                    title="Fewer servings"
                  >
                    −
                  </button>
                  <div className={`text-center min-w-[4rem] ${isScaled ? "text-amber-700 font-semibold" : "text-stone-500"} text-xs`}>
                    <div className="font-bold text-sm">{scaledServings}</div>
                    <div className="leading-none">serving{scaledServings !== 1 ? "s" : ""}</div>
                  </div>
                  <button
                    onClick={() => adjustServings(1)}
                    className="w-6 h-6 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-sm flex items-center justify-center transition-colors"
                    title="More servings"
                  >
                    +
                  </button>
                  {isScaled && (
                    <button
                      onClick={resetServings}
                      className="text-xs text-stone-400 hover:text-amber-700 transition-colors ml-0.5 underline underline-offset-2"
                      title={`Reset to ${originalServings}`}
                    >
                      reset
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Scaled notice */}
            {!isEditing && isScaled && (
              <p className="text-xs text-amber-600 italic mb-3">
                {originalServings !== null
                  ? <>Scaled from {originalServings} serving{originalServings !== 1 ? "s" : ""} — </>
                  : <>Scaled — </>
                }
                amounts marked <span className="text-stone-400">~</span> are unmeasured and unchanged.
              </p>
            )}

            {isEditing ? (
              <div className="space-y-3">
                {draft.ingredients.map((ing, i) => (
                  <div key={i} className="flex gap-1.5 items-start">
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      <input
                        className={inputCls}
                        value={ing.amount}
                        onChange={(e) => updateIngredient(i, "amount", e.target.value)}
                        placeholder="Amount"
                      />
                      <input
                        className={inputCls}
                        value={ing.unit}
                        onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                        placeholder="Unit"
                      />
                      <input
                        className={`${inputCls} col-span-2`}
                        value={ing.name}
                        onChange={(e) => updateIngredient(i, "name", e.target.value)}
                        placeholder="Ingredient name"
                      />
                      <input
                        className={`${inputCls} col-span-2`}
                        value={ing.notes ?? ""}
                        onChange={(e) => updateIngredient(i, "notes", e.target.value)}
                        placeholder="Notes (optional)"
                      />
                    </div>
                    <button
                      onClick={() => removeIngredient(i)}
                      className="text-red-400 hover:text-red-600 mt-1 text-lg leading-none shrink-0"
                      title="Remove ingredient"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                >
                  + Add ingredient
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {display.ingredients.map((ing, i) => {
                  const { display: scaledAmt, scaled } = scaleAmount(ing.amount, scalingMultiplier);
                  return (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={`font-semibold shrink-0 min-w-[3rem] ${isScaled ? "text-amber-700" : "text-amber-600"}`}>
                        {!scaled && ing.amount ? <span className="text-stone-400">~</span> : null}
                        {scaledAmt} {ing.unit}
                      </span>
                      <span className="text-stone-700">
                        {ing.name}
                        {ing.notes && (
                          <span className="text-stone-400 italic ml-1">({ing.notes})</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Instructions */}
          <div className="md:col-span-3 p-6">
            <h2 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <span>📖</span> Method
            </h2>
            {isEditing ? (
              <div className="space-y-3">
                {draft.instructions.map((step, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="flex-shrink-0 w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold mt-1">
                      {i + 1}
                    </span>
                    <textarea
                      className={`${textareaCls} flex-1`}
                      rows={2}
                      value={step}
                      onChange={(e) => updateInstruction(i, e.target.value)}
                      placeholder={`Step ${i + 1}`}
                    />
                    <button
                      onClick={() => removeInstruction(i)}
                      className="text-red-400 hover:text-red-600 mt-1 text-lg leading-none shrink-0"
                      title="Remove step"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addInstruction}
                  className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1 ml-9"
                >
                  + Add step
                </button>
              </div>
            ) : (
              <ol className="space-y-4">
                {display.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <p className="text-stone-700 text-sm leading-relaxed pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Tips, Tricks & Secrets */}
        {(display.tips.length > 0 || isEditing) && (
          <div className="border-t border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
            <h2 className="text-lg font-bold text-amber-800 mb-1 flex items-center gap-2">
              <span>🤫</span> Secrets from the Kitchen
            </h2>
            <p className="text-amber-600 text-xs mb-4 italic">
              The wisdom that doesn&apos;t make it into regular recipes
            </p>
            {isEditing ? (
              <div className="space-y-3">
                {draft.tips.map((tip, i) => (
                  <div key={i} className="flex gap-2 items-start bg-white/70 border border-amber-200 rounded-xl p-3">
                    <div className="flex-1 space-y-2">
                      <select
                        className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        value={tip.category}
                        onChange={(e) => updateTip(i, "category", e.target.value)}
                      >
                        <option value="tip">💡 Tip</option>
                        <option value="trick">✨ Trick</option>
                        <option value="secret">🤫 Secret</option>
                        <option value="note">📝 Note</option>
                      </select>
                      <textarea
                        className={`${textareaCls} w-full`}
                        rows={2}
                        value={tip.content}
                        onChange={(e) => updateTip(i, "content", e.target.value)}
                        placeholder="Tip content"
                      />
                    </div>
                    <button
                      onClick={() => removeTip(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 mt-1"
                      title="Remove tip"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTip}
                  className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
                >
                  + Add tip
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {display.tips.map((tip, i) => (
                  <div
                    key={i}
                    className="bg-white/70 backdrop-blur border border-amber-200 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base">{tipCategoryIcon[tip.category]}</span>
                      <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                        {tipCategoryLabel[tip.category]}
                      </span>
                    </div>
                    <p className="text-stone-700 text-sm leading-relaxed">{tip.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-stone-100 px-6 py-3 text-xs text-stone-400 flex justify-between">
          <span>
            Saved{" "}
            {new Date(recipe.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
          {recipe.updatedAt !== recipe.createdAt && (
            <span>Updated {new Date(recipe.updatedAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
