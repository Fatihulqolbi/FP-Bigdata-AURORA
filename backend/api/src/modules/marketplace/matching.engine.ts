import { prisma } from "../../config/db.js";
import { haversineDistance } from "./listing.service.js";

interface Candidate {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  title: string;
  categoryName: string;
  availableQuantity: number;
  pricePerKg: number;
  distanceKm: number;
  moq: number;
  fulfillmentOptions: string;
  sellerContact: string;
}

interface MatchGroup {
  candidates: Candidate[];
  totalQuantity: number;
  totalCost: number;
  avgDistance: number;
  score: number;
}

const INSTANT_ORDER_THRESHOLD = parseFloat(process.env.INSTANT_ORDER_THRESHOLD || "0.90");
const MAX_DISTANCE_KM = parseFloat(process.env.MAX_DISTANCE_KM || "50");

/**
 * Score weights:
 * - Material match: 40% (always 1.0 for same category)
 * - Quantity available: 20%
 * - Distance: 20%
 * - Price competitiveness: 15%
 * - Seller rating: 5%
 */
function calculateScore(
  buyerLat: number,
  buyerLng: number,
  maxPrice: number,
  candidates: Candidate[]
): number {
  if (candidates.length === 0) return 0;

  const totalQty = candidates.reduce((s, c) => s + c.availableQuantity, 0);
  const avgDist = candidates.reduce((s, c) => s + c.distanceKm, 0) / candidates.length;
  const avgPrice = candidates.reduce((s, c) => s + c.pricePerKg, 0) / candidates.length;
  const avgRating = candidates.reduce((s, c) => s + c.sellerRating, 0) / candidates.length;

  const quantityScore = Math.min(1, totalQty / (totalQty || 1));
  const distanceScore = Math.max(0, 1 - avgDist / MAX_DISTANCE_KM);
  const priceScore = Math.max(0, 1 - avgPrice / (maxPrice || 1));
  const ratingScore = avgRating / 5;

  return (
    0.40 * 1.0 +
    0.20 * quantityScore +
    0.20 * distanceScore +
    0.15 * priceScore +
    0.05 * ratingScore
  );
}

/**
 * Find best match groups for a demand using greedy multi-seller approach.
 * Returns top 5 match groups sorted by score.
 */
export async function findMatches(demandId: string): Promise<{
  demand: any;
  matches: MatchGroup[];
  instantOrderEligible: boolean;
}> {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: { category: true, buyer: true },
  });

  if (!demand) throw new Error("Demand not found");

  const buyerLat = demand.lat ?? demand.buyer.lat ?? -7.2504;
  const buyerLng = demand.lng ?? demand.buyer.lng ?? 112.7688;

  const allListings = await prisma.listing.findMany({
    where: {
      categoryId: demand.categoryId,
      status: "ACTIVE",
      pricePerKg: { lte: demand.maxPrice },
    },
    include: {
      seller: {
        select: { id: true, name: true, sellerRating: true, contact: true },
      },
      category: true,
    },
  });

  // Filter by distance
  const candidates: Candidate[] = allListings
    .map((listing) => {
      const dist = haversineDistance(buyerLat, buyerLng, listing.lat, listing.lng);
      return {
        listingId: listing.id,
        sellerId: listing.sellerId,
        sellerName: listing.seller.name,
        sellerRating: listing.seller.sellerRating,
        title: listing.title,
        categoryName: listing.category.name,
        availableQuantity: listing.quantity,
        pricePerKg: listing.pricePerKg,
        distanceKm: dist,
        moq: listing.moq,
        fulfillmentOptions: listing.fulfillmentOptions,
        sellerContact: listing.seller.contact || "",
      };
    })
    .filter((c) => c.distanceKm <= MAX_DISTANCE_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // Generate match groups (greedy multi-seller)
  const groups: MatchGroup[] = [];
  const targetQty = demand.quantityNeeded;

  // Best single-seller match
  for (const candidate of candidates) {
    if (candidate.availableQuantity >= candidate.moq) {
      const qty = Math.min(candidate.availableQuantity, targetQty);
      const group: MatchGroup = {
        candidates: [{ ...candidate, availableQuantity: qty }],
        totalQuantity: qty,
        totalCost: qty * candidate.pricePerKg,
        avgDistance: candidate.distanceKm,
        score: calculateScore(buyerLat, buyerLng, demand.maxPrice, [{ ...candidate, availableQuantity: qty }]),
      };
      groups.push(group);
    }
  }

  // Multi-seller combinations (greedy)
  if (groups.length < 5 && candidates.length > 1) {
    let remaining = targetQty;
    const selected: Candidate[] = [];
    const used = new Set<string>();

    for (const candidate of candidates) {
      if (used.has(candidate.listingId) || used.has(candidate.sellerId)) continue;
      if (candidate.availableQuantity < candidate.moq) continue;
      if (remaining <= 0) break;

      const take = Math.min(candidate.availableQuantity, remaining);
      selected.push({ ...candidate, availableQuantity: take });
      used.add(candidate.listingId);
      remaining -= take;
    }

    if (selected.length > 1) {
      groups.push({
        candidates: selected,
        totalQuantity: selected.reduce((s, c) => s + c.availableQuantity, 0),
        totalCost: selected.reduce((s, c) => s + c.availableQuantity * c.pricePerKg, 0),
        avgDistance: selected.reduce((s, c) => s + c.distanceKm, 0) / selected.length,
        score: calculateScore(buyerLat, buyerLng, demand.maxPrice, selected),
      });
    }
  }

  // Sort by score descending
  groups.sort((a, b) => b.score - a.score);
  const top = groups.slice(0, 5);

  // Save match suggestions
  await prisma.matchSuggestion.deleteMany({ where: { demandId } });
  for (const group of top) {
    await prisma.matchSuggestion.create({
      data: {
        demandId,
        candidateData: group.candidates as any,
        totalQuantity: group.totalQuantity,
        totalCost: group.totalCost,
        distanceKm: group.avgDistance,
        score: group.score,
        status: "SUGGESTED",
      },
    });
  }

  const instantEligible = top.length > 0 && top[0].score >= INSTANT_ORDER_THRESHOLD;

  return {
    demand,
    matches: top,
    instantOrderEligible: instantEligible,
  };
}

/**
 * Generate match suggestions on demand creation
 */
export async function generateMatchesForDemand(demandId: string): Promise<void> {
  try {
    await findMatches(demandId);
  } catch (err) {
    console.error("Failed to generate matches:", err);
  }
}
