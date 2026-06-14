import { useQuery } from "@tanstack/react-query";
import { listings } from "../api/marketplaceApi";

export function useListings(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["listings", params],
    queryFn: () => listings.list(params),
  });
}

export function useListing(id: string | null) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: () => listings.getById(id!),
    enabled: !!id,
  });
}
