/**
 * Utilities for parsing Amazon URLs and extracting ASINs (Amazon Standard Identification Number)
 */

export function extractAsin(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If already a 10-char alphanumeric ASIN
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Common patterns for Amazon URLs:
  // /dp/B0XXXXXXXX
  // /gp/product/B0XXXXXXXX
  // /gp/aw/d/B0XXXXXXXX
  // /product/B0XXXXXXXX
  // /ASIN/B0XXXXXXXX
  const patterns = [
    /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/|\/ASIN\/)([A-Z0-9]{10})/i,
    /(?:asin=|dp%2F)([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?#]|$)/i
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1] && /^[A-Z0-9]{10}$/i.test(match[1])) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function formatCleanAmazonUrl(asinOrUrl: string): string {
  const asin = extractAsin(asinOrUrl);
  if (asin) {
    return `https://www.amazon.com/dp/${asin}`;
  }
  return asinOrUrl.trim();
}

export function isAmazonUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('amazon.') ||
    lower.includes('amzn.to') ||
    lower.includes('amzn.com') ||
    extractAsin(url) !== null
  );
}

export function matchesAmazonQuery(itemUrl: string, itemAsin: string | undefined, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  const searchAsin = extractAsin(query)?.toLowerCase();
  const itemAsinLower = (itemAsin || extractAsin(itemUrl) || '').toLowerCase();

  // Match by ASIN if query contains one
  if (searchAsin && itemAsinLower && searchAsin === itemAsinLower) {
    return true;
  }

  // Substring match in the URL
  if (itemUrl.toLowerCase().includes(q)) {
    return true;
  }

  // Substring match in ASIN
  if (itemAsinLower && itemAsinLower.includes(q)) {
    return true;
  }

  return false;
}
