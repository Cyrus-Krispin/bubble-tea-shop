import { useEffect, useState } from "react";

import { getGuestLocations, getGuestMenu, getGuestProduct } from "./catalogClient";
import type { CatalogLocation, CatalogMenu, CatalogProduct } from "./types";

type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export function useGuestLocations() {
  const [state, setState] = useState<ResourceState<CatalogLocation[]>>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    getGuestLocations(controller.signal).then(
      (data) => setState({ status: "ready", data }),
      () => { if (!controller.signal.aborted) setState({ status: "error" }); },
    );
    return () => controller.abort();
  }, []);
  return state;
}

export function useGuestMenu(locationSlug?: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ResourceState<CatalogMenu>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getGuestMenu(locationSlug, controller.signal).then(
      (data) => setState({ status: "ready", data }),
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt, locationSlug]);

  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((current) => current + 1);
    },
  };
}

export function useGuestProduct(productSlug: string | undefined, locationSlug?: string) {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<{
    productSlug: string;
    state: ResourceState<CatalogProduct>;
  }>({ productSlug: productSlug ?? "", state: { status: "loading" } });

  useEffect(() => {
    if (!productSlug) return;
    const controller = new AbortController();
    getGuestProduct(productSlug, locationSlug, controller.signal).then(
      (data) => setResource({ productSlug, state: { status: "ready", data } }),
      () => {
        if (!controller.signal.aborted) setResource({ productSlug, state: { status: "error" } });
      },
    );
    return () => controller.abort();
  }, [attempt, locationSlug, productSlug]);

  const state: ResourceState<CatalogProduct> = !productSlug
    ? { status: "error" }
    : resource.productSlug === productSlug
      ? resource.state
      : { status: "loading" };

  return {
    state,
    retry: () => {
      if (productSlug) setResource({ productSlug, state: { status: "loading" } });
      setAttempt((current) => current + 1);
    },
  };
}
