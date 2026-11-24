"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Lightbox } from "@/components/case/lightbox";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_CATEGORIES, LINK_LABELS, SUSPECT_STATUSES, evidenceCategoryLabel, suspectStatusLabel } from "@/lib/constants";
import { ApiError, api } from "@/lib/client";
import { can } from "@/lib/permissions";
import { nodeTitle } from "@/lib/present";
import type { EvidencePayload, GraphData, GraphEdge, GraphNode, NodeKind, RelatedPayload, SuspectPayload } from "@/lib/types";

type Props = {
  caseId: string;
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  locked: boolean;
  onClose: () => void;
  onGraph: (graph: GraphData) => void;
  onFocus: (id: string) => void;
};

async function refresh(caseId: string) {
  return api<GraphData>(`/api/cases/${caseId}/graph`);
}

export function Inspector({ caseId, node, nodes, edges, locked, onClose, onGraph, onFocus }: Props) {
  const { role } = useSession();
  const editable =
    !locked &&
    ((node.kind === "evidence" && can(role, "evidence:edit")) ||
      (node.kind === "suspect" && can(role, "suspect:edit")) ||
      (node.kind === "related" && can(role, "related:edit")));
  const canLink = !locked && can(role, "node:link");
  const canDelete = !locked && can(role, "node:delete") && node.kind !== "case";
  const canPhoto =
    !locked &&
    (node.kind === "evidence"
      ? can(role, "evidence:edit")
      : node.kind === "suspect"
        ? can(role, "suspect:edit")
        : node.kind === "related"
          ? can(role, "related:edit")
          : false);

  const [suspect, setSuspect] = useState<SuspectPayload | null>(node.kind === "suspect" ? node.payload : null);
  const [evidence, setEvidence] = useState<EvidencePayload | null>(node.kind === "evidence" ? node.payload : null);
  const [related, setRelated] = useState<RelatedPayload | null>(node.kind === "related" ? node.payload : null);
  const [saving, setSaving] = useState(false);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkLabel, setLinkLabel] = useState<string>(LINK_LABELS[0]);
  const [customLabel, setCustomLabel] = useState("");
  const [createKind, setCreateKind] = useState<Exclude<NodeKind, "case">>("evidence");
  const [createName, setCreateName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setSuspect(node.kind === "suspect" ? node.payload : null);
    setEvidence(node.kind === "evidence" ? node.payload : null);
    setRelated(node.kind === "related" ? node.payload : null);
    setLinkTarget("");
  }, [node]);

  const links = useMemo(
    () =>
      edges
        .filter((edge) => edge.sourceId === node.id || edge.targetId === node.id)
        .map((edge) => {
          const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
          return { edge, other: nodes.find((item) => item.id === otherId) };
        }),
    [edges, node.id, nodes],
  );

  const others = nodes.filter((item) => item.id !== node.id);

  async function save() {
    const payload = node.kind === "suspect" ? suspect : node.kind === "evidence" ? evidence : related;
    if (!payload) return;
    setSaving(true);
    try {
      await api(`/api/cases/${caseId}/nodes/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({ payload }),
      });
      onGraph(await refresh(caseId));
      toast.success("Node saved.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The node was not saved.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(files: File[]) {
    if (!files.length || !canPhoto) return;
    const form = new FormData();
    for (const file of files) form.append("files", file);
    setUploading(true);
    try {
      await api(`/api/nodes/${node.id}/photos`, { method: "POST", body: form });
      onGraph(await refresh(caseId));
      toast.success(files.length === 1 ? "Photo added." : "Photos added.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The photo was not uploaded.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photoId: string) {
    try {
      await api(`/api/photos/${photoId}`, { method: "DELETE" });
      onGraph(await refresh(caseId));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The photo was not removed.");
    }
  }

  async function addLink() {
    if (!linkTarget) {
      toast.error("Choose a node to link.");
      return;
    }
    const label = linkLabel === "Custom" ? customLabel.trim() : linkLabel;
    try {
      await api(`/api/cases/${caseId}/edges`, {
        method: "POST",
        body: JSON.stringify({ sourceId: node.id, targetId: linkTarget, label }),
      });
      onGraph(await refresh(caseId));
      setLinkTarget("");
      toast.success("Link added.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The link was not created.");
    }
  }

  async function removeLink(edgeId: string) {
    try {
      await api(`/api/cases/${caseId}/edges/${edgeId}`, { method: "DELETE" });
      onGraph(await refresh(caseId));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The link was not removed.");
    }
  }

  async function createLinked() {
    const kind = createKind;
    const name = createName.trim();
    if (!name && kind !== "evidence") {
      toast.error("Name the new node before linking it.");
      return;
    }
    const payload =
      kind === "suspect"
        ? { name, alias: "", status: "person_of_interest", notes: "" }
        : kind === "evidence"
          ? { tag: "", category: "other", description: name, custody: "", notes: "" }
          : { title: name, location: "", occurredAt: "", notes: "" };
    const label = linkLabel === "Custom" ? customLabel.trim() : linkLabel;
    try {
      const graph = await api<GraphData>(`/api/cases/${caseId}/nodes`, {
        method: "POST",
        body: JSON.stringify({ kind, payload, linkTo: node.id, linkLabel: label || "Associated With" }),
      });
      onGraph(graph);
      const created = graph.nodes.find((item) => !nodes.some((existing) => existing.id === item.id));
      if (created) onFocus(created.id);
      setCreateName("");
      toast.success("Node created and linked.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The node was not created.");
    }
  }

  async function removeNode() {
    try {
      await api(`/api/cases/${caseId}/nodes/${node.id}`, { method: "DELETE" });
      onClose();
      onGraph(await refresh(caseId));
      toast.success("Node removed from the chart.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "The node was not deleted.");
    }
  }

  const variant = node.kind === "suspect" ? "suspect" : node.kind === "evidence" ? "evidence" : node.kind === "related" ? "related" : "gold";

  return (
    <aside className="inspector-in absolute inset-y-0 right-0 z-20 flex w-[min(100%,400px)] flex-col border-l border-white/10 bg-ink shadow-[0_0_40px_rgba(0,0,0,0.45)]">
      <div className="flex items-start justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <Badge variant={variant}>{node.kind === "case" ? "Case root" : node.kind}</Badge>
          <h2 className="mt-2 font-display text-2xl tracking-wide">{nodeTitle(node)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close inspector" className="rounded-md p-1 text-fog hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {node.kind === "case" ? (
          <div className="space-y-2 text-sm">
            <div className="font-mono text-gold-bright">{node.payload.caseNumber}</div>
            <p>{node.payload.incidentType}</p>
            <p className="text-fog">{node.payload.location}</p>
            <p className="text-xs text-fog">Edit the incident type, location, and narrative in the file. This node is the root of the chart.</p>
          </div>
        ) : null}

        {node.kind === "suspect" && suspect ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="suspect-name">Name</Label>
              <Input id="suspect-name" value={suspect.name} disabled={!editable} onChange={(event) => setSuspect({ ...suspect, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suspect-alias">Alias</Label>
              <Input id="suspect-alias" value={suspect.alias} disabled={!editable} onChange={(event) => setSuspect({ ...suspect, alias: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={suspect.status} onValueChange={(status) => setSuspect({ ...suspect, status: status as SuspectPayload["status"] })} disabled={!editable}>
                <SelectTrigger aria-label="Suspect status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUSPECT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="suspect-notes">Notes</Label>
              <Textarea id="suspect-notes" value={suspect.notes} disabled={!editable} onChange={(event) => setSuspect({ ...suspect, notes: event.target.value })} />
            </div>
          </div>
        ) : null}

        {node.kind === "evidence" && evidence ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tag">Evidence tag</Label>
                <Input id="tag" value={evidence.tag} disabled={!editable} className="font-mono" onChange={(event) => setEvidence({ ...evidence, tag: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={evidence.category} disabled={!editable} onValueChange={(category) => setEvidence({ ...evidence, category: category as EvidencePayload["category"] })}>
                  <SelectTrigger aria-label="Evidence category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVIDENCE_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={evidence.description} disabled={!editable} onChange={(event) => setEvidence({ ...evidence, description: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custody">Chain of custody</Label>
              <Textarea id="custody" value={evidence.custody} disabled={!editable} onChange={(event) => setEvidence({ ...evidence, custody: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence-notes">Notes</Label>
              <Textarea id="evidence-notes" value={evidence.notes} disabled={!editable} onChange={(event) => setEvidence({ ...evidence, notes: event.target.value })} />
            </div>
          </div>
        ) : null}

        {node.kind === "related" && related ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="related-title">Title</Label>
              <Input id="related-title" value={related.title} disabled={!editable} onChange={(event) => setRelated({ ...related, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="related-location">Location</Label>
              <Input id="related-location" value={related.location} disabled={!editable} onChange={(event) => setRelated({ ...related, location: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="related-notes">Notes</Label>
              <Textarea id="related-notes" value={related.notes} disabled={!editable} onChange={(event) => setRelated({ ...related, notes: event.target.value })} />
            </div>
          </div>
        ) : null}

        {editable ? (
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving" : "Save node"}
          </Button>
        ) : null}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Photos</h3>
          {canPhoto ? (
            <label
              className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-3 py-5 text-center text-sm text-fog ${dragOver ? "border-gold bg-gold/10" : "border-white/15"}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                void upload([...event.dataTransfer.files]);
              }}
            >
              <Upload className="mb-2 h-4 w-4" />
              {uploading ? "Uploading" : "Drop photos or browse"}
              <input
                aria-label="Upload photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void upload([...(event.target.files ?? [])]);
                  event.target.value = "";
                }}
              />
            </label>
          ) : (
            <p className="mt-2 text-xs text-fog">{node.photos.length ? "" : "No photos on this node."}</p>
          )}
          {node.photos.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {node.photos.map((photo, index) => (
                <div key={photo.id} className="group relative">
                  <button type="button" className="block w-full" onClick={() => setLightbox(index)} aria-label={`View ${photo.originalName}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${photo.id}`} alt={photo.originalName} className="aspect-square w-full rounded object-cover ring-1 ring-white/10" />
                  </button>
                  {canPhoto ? (
                    <button
                      type="button"
                      aria-label={`Delete ${photo.originalName}`}
                      className="absolute right-1 top-1 rounded bg-obsidian/80 p-1 text-fog opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void removePhoto(photo.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Linked nodes</h3>
          <ul className="mt-2 space-y-2">
            {links.length === 0 ? <li className="text-xs text-fog">Nothing linked yet.</li> : null}
            {links.map(({ edge, other }) => (
              <li key={edge.id} className="flex items-center gap-2 rounded-md border border-white/8 px-2 py-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => other && onFocus(other.id)}>
                  <div className="truncate text-sm">{other ? nodeTitle(other) : "Missing node"}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">{edge.label}</div>
                </button>
                {canLink ? (
                  <button type="button" aria-label={`Unlink ${edge.label}`} className="text-fog hover:text-status-crimson" onClick={() => void removeLink(edge.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canLink ? (
            <div className="mt-3 space-y-2">
              <Select value={linkTarget || undefined} onValueChange={setLinkTarget}>
                <SelectTrigger aria-label="Link to node">
                  <SelectValue placeholder="Link to node" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.kind} · {nodeTitle(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={linkLabel} onValueChange={setLinkLabel}>
                <SelectTrigger aria-label="Relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom label</SelectItem>
                </SelectContent>
              </Select>
              {linkLabel === "Custom" ? (
                <Input aria-label="Custom relationship" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Relationship" />
              ) : null}
              <Button type="button" variant="secondary" onClick={() => void addLink()}>
                <Link2 />
                Link to node
              </Button>
            </div>
          ) : null}
        </section>

        {canLink ? (
          <section className="space-y-2 border-t border-white/8 pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">Create and link</h3>
            <Select value={createKind} onValueChange={(value) => setCreateKind(value as Exclude<NodeKind, "case">)}>
              <SelectTrigger aria-label="New node type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {can(role, "suspect:create") ? <SelectItem value="suspect">Suspect</SelectItem> : null}
                {can(role, "evidence:create") ? <SelectItem value="evidence">Evidence</SelectItem> : null}
                {can(role, "related:create") ? <SelectItem value="related">Related item</SelectItem> : null}
              </SelectContent>
            </Select>
            <Input
              aria-label="New node name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={createKind === "evidence" ? "Description (tag is assigned)" : "Name or title"}
            />
            <Button type="button" variant="secondary" onClick={() => void createLinked()}>
              Create and link
            </Button>
          </section>
        ) : null}

        {node.kind === "suspect" ? (
          <p className="text-xs text-fog">Status on file: {suspectStatusLabel(node.payload.status)}.</p>
        ) : null}
        {node.kind === "evidence" ? (
          <p className="text-xs text-fog">Category: {evidenceCategoryLabel(node.payload.category)}.</p>
        ) : null}

        {canDelete ? (
          <Button type="button" variant="destructive" onClick={() => void removeNode()}>
            <Trash2 />
            Delete node
          </Button>
        ) : null}
      </div>
      {lightbox !== null ? (
        <Lightbox photos={node.photos} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </aside>
  );
}
