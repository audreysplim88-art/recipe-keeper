"use client";

import dynamic from "next/dynamic";
import type { EventData, Step, Props } from "react-joyride";

// react-joyride uses window internally — lazy-load to avoid SSR crashes
const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false },
) as React.ComponentType<Props>;

import React from "react";

const STEPS: Step[] = [
  {
    target: '[data-tour="recipe-library"]',
    title: "Your Recipe Library",
    content:
      "All your saved recipes appear here, organised by category. As you add more, they'll be grouped automatically.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="add-recipe-btn"]',
    title: "Add a Recipe",
    content:
      "Tap here to save a new recipe — narrate it, paste text, import a URL, or snap a photo.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="capture-tabs"]',
    title: "Multiple Capture Modes",
    content:
      "Choose how you'd like to add your recipe — voice, text, URL, or camera.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="recipe-card"]',
    title: "Your Recipe Card",
    content:
      "Each recipe shows ingredients, instructions, and handy tips from an AI chef.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="sous-chef-btn"]',
    title: "Sous Chef Mode",
    content:
      "Get step-by-step cooking guidance with an AI sous chef who walks you through the recipe.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="edit-btn"]',
    title: "Edit Anytime",
    content:
      "Tweak ingredients, instructions, or tips whenever you like — your recipe, your way.",
    skipBeacon: true,
  },
  {
    target: '[data-tour="account-menu"]',
    title: "Your Account",
    content:
      "Manage your profile, subscription, and settings here.",
    skipBeacon: true,
  },
];

interface OnboardingTourProps {
  run: boolean;
  onComplete: () => void;
}

export default function OnboardingTour({ run, onComplete }: OnboardingTourProps) {
  function handleEvent(data: EventData) {
    const { status } = data;
    if (status === "finished" || status === "skipped") {
      onComplete();
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        buttons: ["back", "primary", "skip"],
        primaryColor: "#92400e",
        textColor: "#1c1917",
        backgroundColor: "#fff",
        arrowColor: "#fff",
        zIndex: 1000,
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Done",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        buttonPrimary: {
          backgroundColor: "#92400e",
          borderRadius: "9999px",
          fontSize: "0.875rem",
          padding: "8px 20px",
        },
        buttonBack: {
          color: "#78716c",
          fontSize: "0.875rem",
        },
        buttonSkip: {
          color: "#78716c",
          fontSize: "0.8125rem",
        },
        tooltip: {
          borderRadius: "1rem",
          padding: "1.25rem",
        },
        tooltipTitle: {
          fontSize: "1rem",
          fontWeight: 700,
        },
        tooltipContent: {
          fontSize: "0.875rem",
          lineHeight: "1.5",
        },
      }}
    />
  );
}
