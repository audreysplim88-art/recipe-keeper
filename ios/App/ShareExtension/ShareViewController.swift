import UIKit
import UniformTypeIdentifiers

/// Minimal Share Extension — extracts the shared URL and hands it off to the
/// main Dodol app via the `dodol://import?url=…` custom URL scheme.
/// No UI is shown; the extension dismisses itself as soon as the app opens.
class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        extractUrl { [weak self] urlString in
            guard let self else { return }

            guard
                let urlString,
                let dodolUrl = Self.buildDodolUrl(from: urlString)
            else {
                self.extensionContext?.cancelRequest(
                    withError: NSError(
                        domain: "app.dodol.recipes.ShareExtension",
                        code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Could not extract a URL from the shared item."]
                    )
                )
                return
            }

            // Open the main Dodol app with the recipe URL encoded as a query param.
            // extensionContext?.open is the correct API for launching the host app
            // from a Share Extension (works on iOS 8+, no App Group required).
            self.extensionContext?.open(dodolUrl) { [weak self] _ in
                self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            }
        }
    }

    // ── URL extraction ────────────────────────────────────────────────────────

    private func extractUrl(completion: @escaping (String?) -> Void) {
        guard
            let item = extensionContext?.inputItems.first as? NSExtensionItem,
            let attachments = item.attachments
        else {
            DispatchQueue.main.async { completion(nil) }
            return
        }

        let urlTypeId   = UTType.url.identifier
        let textTypeId  = UTType.plainText.identifier

        // Prefer a proper URL item (e.g. Safari, Chrome)
        for attachment in attachments where attachment.hasItemConformingToTypeIdentifier(urlTypeId) {
            attachment.loadItem(forTypeIdentifier: urlTypeId, options: nil) { item, _ in
                let result = (item as? URL)?.absoluteString ?? (item as? String)
                DispatchQueue.main.async { completion(result) }
            }
            return
        }

        // Fallback: plain text (e.g. Instagram shares the URL as a string)
        for attachment in attachments where attachment.hasItemConformingToTypeIdentifier(textTypeId) {
            attachment.loadItem(forTypeIdentifier: textTypeId, options: nil) { item, _ in
                let text = item as? String
                let isUrl = text?.hasPrefix("http") == true
                DispatchQueue.main.async { completion(isUrl ? text : nil) }
            }
            return
        }

        DispatchQueue.main.async { completion(nil) }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static func buildDodolUrl(from urlString: String) -> URL? {
        guard let encoded = urlString.addingPercentEncoding(
            withAllowedCharacters: .urlQueryAllowed
        ) else { return nil }
        return URL(string: "dodol://import?url=\(encoded)")
    }
}
