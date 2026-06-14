import { useQuery } from "@tanstack/react-query";
import { orders } from "../api/marketplaceApi";

export function useBuyerOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["orders", "buyer", params],
    queryFn: () => orders.listBuyer(params),
  });
}

export function useSellerOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["orders", "seller", params],
    queryFn: () => orders.listSeller(params),
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => orders.getById(id!),
    enabled: !!id,
  });
}
