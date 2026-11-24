"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/client";
import { ROLE_BRIEF, ROLE_LABEL } from "@/lib/permissions";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [patrolPassword, setPatrolPassword] = useState("");
  const [detectivePassword, setDetectivePassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          patrolPassword,
          detectivePassword,
          adminPassword,
        }),
      });
      toast.success("Role passwords updated. Current sessions stay signed in.");
      setPatrolPassword("");
      setDetectivePassword("");
      setAdminPassword("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Passwords were not updated.");
    } finally {
      setPending(false);
    }
  }

  const fields = [
    { id: "patrol", label: ROLE_LABEL.patrol, brief: ROLE_BRIEF.patrol, value: patrolPassword, set: setPatrolPassword },
    { id: "detective", label: ROLE_LABEL.detective, brief: ROLE_BRIEF.detective, value: detectivePassword, set: setDetectivePassword },
    { id: "admin", label: ROLE_LABEL.admin, brief: ROLE_BRIEF.admin, value: adminPassword, set: setAdminPassword },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Portal settings</DialogTitle>
          <DialogDescription>
            Role passwords are stored hashed in the local database. Leave a field blank to keep the current password.
            Factory defaults from the environment are used only the first time the database is created.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label} password</Label>
              <p className="text-xs text-fog">{field.brief}</p>
              <Input
                id={field.id}
                type="password"
                autoComplete="new-password"
                value={field.value}
                onChange={(event) => field.set(event.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} type="button">
            Cancel
          </Button>
          <Button onClick={save} disabled={pending} type="button">
            {pending ? "Saving" : "Save passwords"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
