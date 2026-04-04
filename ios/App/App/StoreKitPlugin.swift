import Foundation
import Capacitor
import StoreKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKitPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    @objc func getProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }

                call.resolve([
                    "id": product.id,
                    "displayName": product.displayName,
                    "displayPrice": product.displayPrice,
                    "price": product.price.description
                ])
            } catch {
                call.reject("Failed to fetch product: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        print("StoreKit: Starting purchase for \(productId)")

        Task {
            do {
                let products = try await Product.products(for: [productId])
                print("StoreKit: Found \(products.count) products")
                
                guard let product = products.first else {
                    print("StoreKit: Product not found")
                    call.reject("Product not found")
                    return
                }

                print("StoreKit: Purchasing \(product.displayName)")
                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        print("StoreKit: Purchase successful, txn \(transaction.id)")
                        call.resolve([
                            "success": true,
                            "transactionId": String(transaction.id),
                            "productId": transaction.productID
                        ])
                    case .unverified(_, let error):
                        print("StoreKit: Unverified - \(error)")
                        call.reject("Unverified transaction: \(error.localizedDescription)")
                    }
                case .userCancelled:
                    print("StoreKit: User cancelled")
                    call.resolve([
                        "success": false,
                        "cancelled": true
                    ])
                case .pending:
                    print("StoreKit: Pending")
                    call.resolve([
                        "success": false,
                        "pending": true
                    ])
                @unknown default:
                    call.reject("Unknown purchase result")
                }
            } catch {
                print("StoreKit: Error - \(error)")
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()

                var restored = false
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        if transaction.productID == call.getString("productId") {
                            restored = true
                            break
                        }
                    }
                }

                call.resolve([
                    "restored": restored
                ])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }
}
