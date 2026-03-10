import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "../stores/useAppStore";
import {
  Toolbar,
  EmptyState,
  Button,
  Modal,
  Input,
  Badge,
} from "../components/atoms";
import { ProfileDetailsPanel } from "../components/molecules";
import * as api from "../services/api";
import type { LaunchInstanceRequest, Profile } from "../generated/types";

function getProfileKey(profile: Profile) {
  return profile.id || profile.name;
}

export default function ProfilesPage() {
  const {
    profiles,
    instances,
    profilesLoading,
    setProfiles,
    setProfilesLoading,
    setInstances,
  } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showLaunch, setShowLaunch] = useState<string | null>(null);
  const [selectedProfileKey, setSelectedProfileKey] = useState<string | null>(
    null,
  );

  // Create form
  const [createName, setCreateName] = useState("");
  const [createUseWhen, setCreateUseWhen] = useState("");
  const [createSource, setCreateSource] = useState("");

  // Launch form
  const [launchPort, setLaunchPort] = useState("");
  const [launchHeadless, setLaunchHeadless] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [launchLoading, setLaunchLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");

  const loadProfiles = async (preferredProfileKey?: string) => {
    setProfilesLoading(true);
    try {
      const data = await api.fetchProfiles();
      setProfiles(data);
      if (preferredProfileKey) {
        const preferred = data.find(
          (profile) =>
            getProfileKey(profile) === preferredProfileKey ||
            profile.name === preferredProfileKey,
        );
        if (preferred) {
          setSelectedProfileKey(getProfileKey(preferred));
        }
      }
    } catch (e) {
      console.error("Failed to load profiles", e);
    } finally {
      setProfilesLoading(false);
    }
  };

  // Load once on mount if empty — SSE handles updates
  useEffect(() => {
    if (profiles.length === 0) {
      loadProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      const created = await api.createProfile({
        name: createName.trim(),
        useWhen: createUseWhen.trim() || undefined,
      });
      setShowCreate(false);
      setCreateName("");
      setCreateUseWhen("");
      setCreateSource("");
      loadProfiles(created.id || created.name);
    } catch (e) {
      console.error("Failed to create profile", e);
    }
  };

  const handleLaunch = async () => {
    if (!showLaunch || launchLoading) return;
    setLaunchError("");
    setLaunchLoading(true);
    try {
      const payload: LaunchInstanceRequest = {
        name: showLaunch,
        port: launchPort.trim() || undefined,
        mode: launchHeadless ? undefined : "headed",
      };
      console.log("Launching instance:", payload);
      const result = await api.launchInstance(payload);
      console.log("Launch result:", result);
      setShowLaunch(null);
      setLaunchPort("");
      setLaunchHeadless(false);
      // Refresh instances list
      const updated = await api.fetchInstances();
      setInstances(updated);
    } catch (e) {
      console.error("Launch failed:", e);
      const msg = e instanceof Error ? e.message : "Failed to launch instance";
      setLaunchError(msg);
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleStop = async (profileName: string) => {
    const inst = instanceByProfile.get(profileName);
    if (!inst) return;
    try {
      await api.stopInstance(inst.id);
      const updated = await api.fetchInstances();
      setInstances(updated);
    } catch (e) {
      console.error("Failed to stop instance", e);
    }
  };

  const handleDelete = async () => {
    if (!selectedProfile?.id) return;
    try {
      await api.deleteProfile(selectedProfile.id);
      setSelectedProfileKey(null);
      loadProfiles();
    } catch (e) {
      console.error("Failed to delete profile", e);
    }
  };

  const handleSave = async (name: string, useWhen: string) => {
    if (!selectedProfile?.id) return;
    try {
      const updated = await api.updateProfile(selectedProfile.id, {
        name: name !== selectedProfile.name ? name : undefined,
        useWhen: useWhen !== selectedProfile.useWhen ? useWhen : undefined,
      });
      loadProfiles(updated.id || selectedProfile.id);
    } catch (e) {
      console.error("Failed to update profile", e);
    }
  };

  // Generate launch command
  const launchCommand = useMemo(() => {
    if (!showLaunch) return "";
    const profile = profiles.find((p) => p.name === showLaunch);
    const profileId = profile?.id || showLaunch;
    const payload: LaunchInstanceRequest = {
      profileId,
      mode: launchHeadless ? undefined : "headed",
      port: launchPort.trim() || undefined,
    };

    return `curl -X POST http://localhost:9867/instances/start -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`;
  }, [showLaunch, launchHeadless, launchPort, profiles]);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(launchCommand);
      setCopyFeedback("Copied!");
      setTimeout(() => setCopyFeedback(""), 2000);
    } catch {
      setCopyFeedback("Failed to copy");
      setTimeout(() => setCopyFeedback(""), 2000);
    }
  };

  const instanceByProfile = new Map(instances.map((i) => [i.profileName, i]));
  const selectedProfile =
    profiles.find((profile) => getProfileKey(profile) === selectedProfileKey) ||
    null;
  const runningProfiles = instances.filter(
    (instance) => instance.status === "running",
  ).length;

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfileKey(null);
      return;
    }

    if (
      !selectedProfileKey ||
      !profiles.some((profile) => getProfileKey(profile) === selectedProfileKey)
    ) {
      setSelectedProfileKey(getProfileKey(profiles[0]));
    }
  }, [profiles, selectedProfileKey]);

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        actions={[
          { key: "refresh", label: "Refresh", onClick: loadProfiles },
          {
            key: "new",
            label: "New Profile",
            onClick: () => setShowCreate(true),
            variant: "primary",
          },
        ]}
      />

      <div className="flex flex-1 flex-col overflow-hidden p-4 lg:p-6">
        <div className="h-full">
          {profilesLoading && profiles.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              Loading profiles...
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              title="No profiles yet"
              description="Click New Profile to create one"
              action={
                <Button variant="primary" onClick={() => setShowCreate(true)}>
                  New Profile
                </Button>
              }
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
              <div className="dashboard-panel flex max-h-[22rem] w-full shrink-0 flex-col overflow-hidden lg:max-h-none lg:w-80">
                <div className="border-b border-border-subtle px-4 py-3">
                  <div className="dashboard-section-label mb-1">Profiles</div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-text-secondary">
                      Profiles ({profiles.length})
                    </h3>
                    <Badge
                      variant={runningProfiles > 0 ? "success" : "default"}
                    >
                      {runningProfiles} running
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-2">
                  <div className="space-y-2">
                    {profiles.map((profile) => {
                      const instance = instanceByProfile.get(profile.name);
                      const isSelected =
                        getProfileKey(profile) === selectedProfileKey;
                      const accountText =
                        profile.accountEmail ||
                        profile.accountName ||
                        "No account";
                      const statusVariant =
                        instance?.status === "running"
                          ? "success"
                          : instance?.status === "error"
                            ? "danger"
                            : "default";
                      const statusLabel =
                        instance?.status === "running"
                          ? `:${instance.port}`
                          : instance?.status === "error"
                            ? "error"
                            : "stopped";

                      return (
                        <button
                          key={getProfileKey(profile)}
                          type="button"
                          onClick={() =>
                            setSelectedProfileKey(getProfileKey(profile))
                          }
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? "dashboard-panel-selected border-primary"
                              : "dashboard-panel-hover border-border-subtle bg-black/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-text-primary">
                                {profile.name}
                              </div>
                              <div className="mt-1 text-xs text-text-muted">
                                {accountText}
                              </div>
                            </div>
                            <Badge variant={statusVariant}>{statusLabel}</Badge>
                          </div>

                          {profile.useWhen && (
                            <div className="mt-3 line-clamp-2 text-xs leading-5 text-text-secondary">
                              {profile.useWhen}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="min-h-0 min-w-0 flex-1">
                <ProfileDetailsPanel
                  profile={selectedProfile}
                  instance={
                    selectedProfile
                      ? instanceByProfile.get(selectedProfile.name)
                      : undefined
                  }
                  onLaunch={() =>
                    selectedProfile && setShowLaunch(selectedProfile.name)
                  }
                  onStop={() =>
                    selectedProfile && handleStop(selectedProfile.name)
                  }
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Profile Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="📁 New Profile"
        wide
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!createName.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            placeholder="e.g. personal, work, scraping"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <Input
            label="Use this profile when (helps agents pick the right profile)"
            placeholder="e.g. I need to access Gmail for the team account"
            value={createUseWhen}
            onChange={(e) => setCreateUseWhen(e.target.value)}
          />
          <Input
            label="Import from (optional — Chrome user data path)"
            placeholder="e.g. /Users/you/Library/Application Support/Google/Chrome"
            value={createSource}
            onChange={(e) => setCreateSource(e.target.value)}
          />
        </div>
      </Modal>

      {/* Launch Modal */}
      <Modal
        open={!!showLaunch}
        onClose={() => {
          setShowLaunch(null);
          setLaunchError("");
        }}
        title="🖥️ Start Profile"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={launchLoading}
              onClick={() => {
                setShowLaunch(null);
                setLaunchError("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleLaunch}
              loading={launchLoading}
            >
              Start
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {launchError && (
            <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {launchError}
            </div>
          )}
          <Input
            label="Port"
            placeholder="Auto-select from configured range"
            value={launchPort}
            onChange={(e) => setLaunchPort(e.target.value)}
          />
          <p className="-mt-2 text-xs text-text-muted">
            Leave blank to auto-select a free port from the configured instance
            port range.
          </p>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={launchHeadless}
              onChange={(e) => setLaunchHeadless(e.target.checked)}
              className="h-4 w-4"
            />
            Headless (best for Docker/VPS)
          </label>

          {/* Command */}
          <div>
            <label className="mb-1 block text-xs text-text-muted">
              Direct launch command (backup)
            </label>
            <textarea
              readOnly
              value={launchCommand}
              className="h-20 w-full resize-none rounded border border-border-subtle bg-bg-elevated px-3 py-2 font-mono text-xs text-text-secondary"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleCopyCommand}>
                Copy Command
              </Button>
              {copyFeedback && (
                <span className="text-xs text-success">{copyFeedback}</span>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
