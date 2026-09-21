import createClient from "openapi-fetch";
import type { components, paths } from "../../api/generated";
import type { CreateGuestOrderInput } from "../cart/orderClient";
export type Favorite = components["schemas"]["CustomerFavorite"];
export type OrderQuote = components["schemas"]["CustomerOrderQuote"];
const client = (token: string) => createClient<paths>({ baseUrl: window.location.origin, headers: { Authorization: `Bearer ${token}` } });
function favorite(data: unknown): Favorite {
  if (typeof data !== "object" || data === null) throw new Error("Favorite unavailable");
  const value = data as Record<string, unknown>;
  if (!Array.isArray(value.recipes) || typeof value.discountPercent !== "number") throw new Error("Favorite unavailable");
  return validateFavorite({ recipeId: value.recipeId as string | null, recipeName: value.recipeName as string | null,
    recipes: value.recipes, discountPercent: value.discountPercent });
}
function validateFavorite(data: Favorite): Favorite {
  if (!data || !Array.isArray(data.recipes) || !Number.isInteger(data.discountPercent)
    || data.discountPercent < 0 || data.discountPercent > 100
    || data.recipes.some((recipe) => !recipe || typeof recipe.id !== "string" || typeof recipe.name !== "string")
    || (data.recipeId !== null && typeof data.recipeId !== "string")
    || (data.recipeName !== null && typeof data.recipeName !== "string")) throw new Error("Favorite unavailable");
  return { ...data, recipes: data.recipes.map((recipe) => ({ ...recipe })) };
}
export async function getFavorite(token: string, locationSlug: string, signal?: AbortSignal) {
  const { data } = await client(token).GET("/api/v1/customer/locations/{locationSlug}/favorite", { params: { path: { locationSlug } }, signal });
  return favorite(data);
}
export async function saveFavorite(token: string, locationSlug: string, recipeId: string | null) {
  if (recipeId === null) {
    const { data } = await client(token).DELETE("/api/v1/customer/locations/{locationSlug}/favorite", { params: { path: { locationSlug } } });
    return favorite(data);
  }
  const { data } = await client(token).PUT("/api/v1/customer/locations/{locationSlug}/favorite", { params: { path: { locationSlug } }, body: { recipeId } });
  return favorite(data);
}
export async function getCustomerOrderQuote(token: string, locationSlug: string, input: CreateGuestOrderInput, signal?: AbortSignal): Promise<OrderQuote> {
  const { data } = await client(token).POST("/api/v1/customer/locations/{locationSlug}/order-quote", { params: { path: { locationSlug } }, body: input, signal });
  if (!data || ![data.subtotalMinor, data.discountMinor, data.totalMinor].every((amount) => Number.isSafeInteger(amount) && amount >= 0)
    || data.totalMinor !== data.subtotalMinor - data.discountMinor || !/^[A-Z]{3}$/.test(data.currencyCode)) throw new Error("Current prices unavailable");
  return data;
}
