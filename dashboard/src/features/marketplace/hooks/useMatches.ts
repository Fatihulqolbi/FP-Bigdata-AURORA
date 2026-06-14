import { useQuery } from "@tanstack/react-query";
import { matches } from "../api/marketplaceApi";

export function useMatches(demandId: string | null) {
  return useQuery({
    queryKey: ["matches", demandId],
    queryFn: () => matches.getForDemand(demandId!),
    enabled: !!demandId,
  });
}
