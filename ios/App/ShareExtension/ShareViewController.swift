import UIKit
import UniformTypeIdentifiers

/// iOS Share Extension — copies the shared recipe URL to the clipboard
/// and shows a brief confirmation. When the user next opens Dodol,
/// the app detects the URL and offers to import it.
class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.04, blue: 0.06, alpha: 0.92)

        extractUrl { [weak self] urlString in
            guard let self else { return }

            guard let urlString else {
                self.showMessage(
                    icon: "⚠️",
                    title: "No URL found",
                    subtitle: "Only web links can be saved to Dodol."
                )
                self.dismissAfter(2)
                return
            }

            // Copy the URL to the clipboard
            UIPasteboard.general.string = urlString

            self.showMessage(
                icon: "✅",
                title: "Recipe link copied!",
                subtitle: "Open Dodol to import this recipe."
            )
            self.dismissAfter(2)
        }
    }

    // ── UI ─────────────────────────────────────────────────────────────────────

    private func showMessage(icon: String, title: String, subtitle: String) {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false

        let iconLabel = UILabel()
        iconLabel.text = icon
        iconLabel.font = .systemFont(ofSize: 40)

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)

        let subtitleLabel = UILabel()
        subtitleLabel.text = subtitle
        subtitleLabel.textColor = UIColor(white: 0.6, alpha: 1)
        subtitleLabel.font = .systemFont(ofSize: 14)
        subtitleLabel.numberOfLines = 0
        subtitleLabel.textAlignment = .center

        stack.addArrangedSubview(iconLabel)
        stack.addArrangedSubview(titleLabel)
        stack.addArrangedSubview(subtitleLabel)

        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -32),
        ])
    }

    private func dismissAfter(_ seconds: Double) {
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
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

        let urlTypeId  = UTType.url.identifier
        let textTypeId = UTType.plainText.identifier

        for attachment in attachments where attachment.hasItemConformingToTypeIdentifier(urlTypeId) {
            attachment.loadItem(forTypeIdentifier: urlTypeId, options: nil) { item, _ in
                let result = (item as? URL)?.absoluteString ?? (item as? String)
                DispatchQueue.main.async { completion(result) }
            }
            return
        }

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
}
