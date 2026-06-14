import { useQuery } from "@tanstack/react-query";
import { demands } from "../api/marketplaceApi";

export function useDemands(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["demands", params],
    queryFn: () => demands.list(params),
  });
}

export function useDemand(id: string | null) {
  return useQuery({
    queryKey: ["demand", id],
    queryFn: () => demands.getById(id!),
    enabled: !!id,
  });
}
