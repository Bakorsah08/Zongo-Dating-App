import { LOG_LEVEL, PRODUCT_CATEGORY, Purchases } from '@revenuecat/purchases-capacitor';
import { isNativeApp, nativePlatform } from '../../lib/platform';

let configured = false;

function getPlatformApiKey(): string | null {
  const platform = nativePlatform();
  if (platform === 'ios') {
    return (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined)?.trim() || null;
  }
  if (platform === 'android') {
    return (import.meta.env.VITE_REVENUECAT_GOOGLE_API_KEY as string | undefined)?.trim() || null;
  }
  return null;
}

export function isRevenueCatConfigured(): boolean {
  return Boolean(getPlatformApiKey());
}

/** Configure RevenueCat once per app session (native only). */
export async function configureRevenueCatIfNeeded(): Promise<boolean> {
  if (!isNativeApp()) return false;
  if (configured) return true;

  const apiKey = getPlatformApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] Missing VITE_REVENUECAT_IOS_API_KEY or VITE_REVENUECAT_GOOGLE_API_KEY');
    return false;
  }

  await Purchases.configure({ apiKey });
  if (import.meta.env.DEV) {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
  }
  configured = true;
  return true;
}

/** Link store purchases to Supabase user id (required for wallet webhook credit). */
export async function revenueCatLogIn(appUserId: string): Promise<void> {
  if (!appUserId.trim()) return;
  if (!(await configureRevenueCatIfNeeded())) return;
  await Purchases.logIn({ appUserID: appUserId });
}

export async function revenueCatLogOut(): Promise<void> {
  if (!configured || !isNativeApp()) return;
  try {
    await Purchases.logOut();
  } catch {
    /* ignore */
  }
}

type PurchaseOutcome =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };

function isUserCancelled(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const o = err as Record<string, unknown>;
  if (o.userCancelled === true) return true;
  const nested = o.error;
  if (nested && typeof nested === 'object' && (nested as Record<string, unknown>).userCancelled === true) {
    return true;
  }
  return false;
}

function purchaseErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return 'Purchase could not be completed.';
}

async function findPackageForProductId(productId: string) {
  const offerings = await Purchases.getOfferings();
  const candidates = [
    offerings.current,
    ...Object.values(offerings.all ?? {}),
  ].filter((o): o is NonNullable<typeof offerings.current> => Boolean(o));

  for (const offering of candidates) {
    for (const pkg of offering.availablePackages ?? []) {
      if (pkg.product.identifier === productId) return pkg;
    }
  }
  return null;
}

/**
 * Start an App Store / Play consumable purchase for a store product id
 * (same value as token_packages.revenuecat_product_id).
 */
export async function purchaseRevenueCatProduct(revenuecatProductId: string): Promise<PurchaseOutcome> {
  const productId = revenuecatProductId.trim();
  if (!productId) {
    return { ok: false, message: 'This package is not linked to an App Store / Play product yet.' };
  }

  if (!(await configureRevenueCatIfNeeded())) {
    return {
      ok: false,
      message: 'In-app purchases are not configured. Add RevenueCat API keys for this platform.',
    };
  }

  try {
    const rcPackage = await findPackageForProductId(productId);
    if (rcPackage) {
      await Purchases.purchasePackage({ aPackage: rcPackage });
      return { ok: true };
    }

    const { products } = await Purchases.getProducts({
      productIdentifiers: [productId],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });
    if (!products.length) {
      return {
        ok: false,
        message:
          'Product not found in the store. Confirm the SKU in admin, RevenueCat, and App Store Connect / Play Console.',
      };
    }

    await Purchases.purchaseStoreProduct({ product: products[0]! });
    return { ok: true };
  } catch (err) {
    if (isUserCancelled(err)) {
      return { ok: false, cancelled: true, message: 'Purchase canceled.' };
    }
    return { ok: false, message: purchaseErrorMessage(err) };
  }
}
