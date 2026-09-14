/* Phase 90e — ViewAsProvider / useViewAs / useEffectiveClientIdentity.
   The provider is exercised through a tiny harness component rendered
   with react-dom (no @testing-library/react in this project); auth
   and supabase are module-mocked so the tests stay offline. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ViewAsProvider,
  useViewAs,
  useEffectiveClientIdentity,
} from "@/hooks/useViewAs";
import {
  VIEW_AS_KEY_PREFIX,
  viewAsStorageKey,
  type ViewAsIdentity,
} from "@/lib/viewAs";

/* ── mocks ─────────────────────────────────────────────────────── */

const mockState = vi.hoisted(() => ({
  user: null as unknown,
  loading: false,
  profilesRow: null as unknown,
  clientsRow: null as unknown,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => {
    const user = mockState.user as {
      id: string;
      email: string;
      full_name: string | null;
      role: "trainer" | "client" | "admin";
    } | null;
    return {
      user,
      loading: mockState.loading as boolean,
      isAdmin: user?.role === "admin",
      isTrainer: user?.role === "trainer" || user?.role === "admin",
      isClient: user?.role === "client" || user?.role === "admin",
      logout: vi.fn(),
      refreshUser: vi.fn(),
      loginAsAdmin: vi.fn(),
    };
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: table === "clients" ? mockState.clientsRow : null,
              }),
            }),
          }),
          maybeSingle: async () => ({
            data: table === "profiles" ? mockState.profilesRow : null,
          }),
        }),
      }),
    }),
  },
}));

/* ── harness ───────────────────────────────────────────────────── */

interface HarnessSnapshot {
  viewAs: ViewAsIdentity | null;
  identity: ReturnType<typeof useEffectiveClientIdentity> | null;
}

interface HarnessCapture {
  snapshot: HarnessSnapshot;
  beginViewAs: ((id: ViewAsIdentity) => void) | null;
  endViewAs: (() => void) | null;
}

// Mutated by the harness (property writes — the react-hooks/globals
// rule only forbids reassigning outer variables during render).
const capture: HarnessCapture = {
  snapshot: { viewAs: null, identity: null },
  beginViewAs: null,
  endViewAs: null,
};

/* The harness only RECORDS what the hooks returned (and exposes the
   context actions) for test assertions — the react-hooks render-purity
   rules don't model this test capture pattern. */
/* eslint-disable react-hooks/immutability */
function Harness() {
  const ctx = useViewAs();
  const identity = useEffectiveClientIdentity();
  capture.snapshot = { viewAs: ctx.viewAs, identity };
  capture.beginViewAs = ctx.beginViewAs;
  capture.endViewAs = ctx.endViewAs;
  return null;
}
/* eslint-enable react-hooks/immutability */

let container: HTMLDivElement;
let root: Root;

async function renderProvider() {
  await act(async () => {
    root.render(
      <ViewAsProvider>
        <Harness />
      </ViewAsProvider>,
    );
  });
}

/** Force a re-render (the auth mock is not reactive — tests bump
 *  mockState then call this so provider effects re-run). */
async function rerender() {
  await act(async () => {
    root.render(
      <ViewAsProvider>
        <Harness />
      </ViewAsProvider>,
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  capture.snapshot = { viewAs: null, identity: null };
  capture.beginViewAs = null;
  capture.endViewAs = null;
  mockState.user = {
    id: "trainer-1",
    email: "coach@azfit.ai",
    full_name: "Coach",
    role: "trainer",
  };
  mockState.loading = false;
  mockState.profilesRow = null;
  mockState.clientsRow = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

async function cleanupRoot() {
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

const TARGET: ViewAsIdentity = {
  clientId: "client-1",
  email: "sarah@example.com",
  name: "Sarah Chen",
};

/* ── tests ─────────────────────────────────────────────────────── */

describe("ViewAsProvider (Phase 90e)", () => {
  it("starts with no override when storage is empty", async () => {
    await renderProvider();
    expect(capture.snapshot.viewAs).toBeNull();
    await cleanupRoot();
  });

  it("beginViewAs sets state and writes the scoped key with savedAt", async () => {
    await renderProvider();
    act(() => capture.beginViewAs!(TARGET));
    expect(capture.snapshot.viewAs).toEqual(TARGET);
    const raw = sessionStorage.getItem(viewAsStorageKey(TARGET.clientId));
    expect(raw).toBeTruthy();
    const payload = JSON.parse(raw!) as Record<string, unknown>;
    expect(payload.savedAt).toEqual(expect.any(Number));
    await cleanupRoot();
  });

  it("beginViewAs clears any other azfit:view-as:* key", async () => {
    sessionStorage.setItem(
      viewAsStorageKey("other-client"),
      JSON.stringify({ clientId: "other-client", email: "o@x.com", name: "O", savedAt: 1 }),
    );
    await renderProvider();
    expect(capture.snapshot.viewAs?.clientId).toBe("other-client");
    act(() => capture.beginViewAs!(TARGET));
    expect(sessionStorage.getItem(viewAsStorageKey("other-client"))).toBeNull();
    expect(sessionStorage.getItem(viewAsStorageKey(TARGET.clientId))).toBeTruthy();
    await cleanupRoot();
  });

  it("endViewAs removes the key and clears state", async () => {
    await renderProvider();
    act(() => capture.beginViewAs!(TARGET));
    act(() => capture.endViewAs!());
    expect(capture.snapshot.viewAs).toBeNull();
    expect(sessionStorage.getItem(viewAsStorageKey(TARGET.clientId))).toBeNull();
    await cleanupRoot();
  });

  it("init restores the most recently written override", async () => {
    const older: ViewAsIdentity = { clientId: "old", email: "old@x.com", name: "Old" };
    sessionStorage.setItem(
      viewAsStorageKey(older.clientId),
      JSON.stringify({ ...older, savedAt: 100 }),
    );
    sessionStorage.setItem(
      viewAsStorageKey(TARGET.clientId),
      JSON.stringify({ ...TARGET, savedAt: 200 }),
    );
    await renderProvider();
    expect(capture.snapshot.viewAs).toEqual(TARGET);
    // invariant: at most one key survives init
    const keys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith(VIEW_AS_KEY_PREFIX),
    );
    expect(keys).toHaveLength(1);
    await cleanupRoot();
  });

  it("init drops malformed keys and starts clean", async () => {
    sessionStorage.setItem(viewAsStorageKey("bad"), "{{{not json");
    sessionStorage.setItem(
      viewAsStorageKey("partial"),
      JSON.stringify({ clientId: "partial" }), // missing email
    );
    await renderProvider();
    expect(capture.snapshot.viewAs).toBeNull();
    expect(sessionStorage.getItem(viewAsStorageKey("bad"))).toBeNull();
    expect(sessionStorage.getItem(viewAsStorageKey("partial"))).toBeNull();
    await cleanupRoot();
  });

  it("clears the override when the auth session resolves to no user", async () => {
    mockState.loading = true;
    await renderProvider();
    act(() => capture.beginViewAs!(TARGET));
    expect(capture.snapshot.viewAs).toEqual(TARGET);
    // session ends → auth resolves with no user
    mockState.loading = false;
    mockState.user = null;
    await rerender();
    expect(capture.snapshot.viewAs).toBeNull();
    expect(sessionStorage.getItem(viewAsStorageKey(TARGET.clientId))).toBeNull();
    await cleanupRoot();
  });
});

describe("useEffectiveClientIdentity (Phase 90e)", () => {
  it("trainer without override → all null, trivially resolved", async () => {
    mockState.user = {
      id: "trainer-1",
      email: "coach@azfit.ai",
      full_name: "Coach",
      role: "trainer",
    };
    await renderProvider();
    expect(capture.snapshot.identity).toEqual({
      clientId: null,
      clientEmail: null,
      profileId: null,
      isOverride: false,
      resolved: true,
    });
    await cleanupRoot();
  });

  it("override active → target identity; profileId null until resolved", async () => {
    mockState.user = {
      id: "trainer-1",
      email: "coach@azfit.ai",
      full_name: "Coach",
      role: "trainer",
    };
    mockState.profilesRow = { id: "target-profile-1" };
    await renderProvider();
    act(() => capture.beginViewAs!(TARGET));
    expect(capture.snapshot.identity?.isOverride).toBe(true);
    expect(capture.snapshot.identity?.clientId).toBe(TARGET.clientId);
    expect(capture.snapshot.identity?.clientEmail).toBe(TARGET.email);
    await act(async () => {
      await Promise.resolve();
    });
    expect(capture.snapshot.identity?.profileId).toBe("target-profile-1");
    expect(capture.snapshot.identity?.resolved).toBe(true);
    await cleanupRoot();
  });

  it("client without override → own clients row + own profile id", async () => {
    mockState.user = {
      id: "own-profile-1",
      email: "me@example.com",
      full_name: "Me",
      role: "client",
    };
    mockState.clientsRow = { id: "own-client-1" };
    await renderProvider();
    await act(async () => {
      await Promise.resolve();
    });
    expect(capture.snapshot.identity).toEqual({
      clientId: "own-client-1",
      clientEmail: "me@example.com",
      profileId: "own-profile-1",
      isOverride: false,
      resolved: true,
    });
    await cleanupRoot();
  });

  it("override wins over role: a trainer resolves the target, not themselves", async () => {
    mockState.user = {
      id: "trainer-1",
      email: "coach@azfit.ai",
      full_name: "Coach",
      role: "trainer",
    };
    mockState.profilesRow = { id: "target-profile-1" };
    await renderProvider();
    act(() => capture.beginViewAs!(TARGET));
    await act(async () => {
      await Promise.resolve();
    });
    expect(capture.snapshot.identity?.clientId).not.toBe("trainer-1");
    expect(capture.snapshot.identity?.profileId).toBe("target-profile-1");
    await cleanupRoot();
  });
});
