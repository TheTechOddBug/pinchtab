import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilesPage from "./ProfilesPage";
import { useAppStore } from "../stores/useAppStore";
import type { Instance, Profile } from "../generated/types";

vi.mock("../services/api", () => ({
  fetchProfiles: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  updateProfile: vi.fn(),
  fetchInstances: vi.fn(),
  launchInstance: vi.fn(),
  stopInstance: vi.fn(),
  fetchInstanceTabs: vi.fn(),
  fetchInstanceLogs: vi.fn(),
}));

const profiles: Profile[] = [
  {
    id: "prof_alpha",
    name: "alpha",
    created: "2026-03-01T10:00:00Z",
    lastUsed: "2026-03-05T10:00:00Z",
    diskUsage: 1024,
    sizeMB: 12,
    running: false,
    useWhen: "Use for personal logins",
  },
  {
    id: "prof_beta",
    name: "beta",
    created: "2026-03-02T10:00:00Z",
    lastUsed: "2026-03-06T10:00:00Z",
    diskUsage: 2048,
    sizeMB: 24,
    running: true,
    accountEmail: "team@example.com",
  },
];

const instances: Instance[] = [
  {
    id: "inst_beta",
    profileId: "prof_beta",
    profileName: "beta",
    port: "9988",
    headless: false,
    status: "running",
    startTime: "2026-03-06T10:00:00Z",
    attached: false,
  },
];

describe("ProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      profiles,
      profilesLoading: false,
      instances,
    });
  });

  it("auto-selects the first profile and renders its details", async () => {
    render(<ProfilesPage />);

    let detailPanel: HTMLElement;
    await waitFor(() => {
      detailPanel = screen
        .getByRole("heading", { name: "alpha" })
        .closest(".dashboard-panel") as HTMLElement;
      expect(detailPanel).toBeInTheDocument();
    });

    detailPanel = screen
      .getByRole("heading", { name: "alpha" })
      .closest(".dashboard-panel") as HTMLElement;

    expect(
      within(detailPanel).getAllByText("Use for personal logins").length,
    ).toBeGreaterThan(0);
    expect(
      within(detailPanel).getByRole("button", { name: "Start" }),
    ).toBeInTheDocument();
  });

  it("switches the right detail pane when selecting another profile", async () => {
    render(<ProfilesPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "alpha" }),
      ).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /beta/i }));

    const detailPanel = screen
      .getByRole("heading", { name: "beta" })
      .closest(".dashboard-panel") as HTMLElement;

    expect(detailPanel).toBeInTheDocument();
    expect(
      within(detailPanel).getAllByText("team@example.com").length,
    ).toBeGreaterThan(0);
    expect(
      within(detailPanel).getByText("Running on :9988"),
    ).toBeInTheDocument();
    expect(
      within(detailPanel).getByRole("button", { name: "Stop" }),
    ).toBeInTheDocument();
  });

  it("enables save only after profile fields change", async () => {
    render(<ProfilesPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "alpha" }),
      ).toBeInTheDocument();
    });

    const detailPanel = screen
      .getByRole("heading", { name: "alpha" })
      .closest(".dashboard-panel") as HTMLElement;
    const saveButton = within(detailPanel).getByRole("button", {
      name: "Save",
    });
    const nameInput = within(detailPanel).getByDisplayValue("alpha");

    expect(saveButton).toBeDisabled();

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "alpha-updated");

    expect(saveButton).toBeEnabled();
  });
});
