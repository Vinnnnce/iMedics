"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Trash2, PhoneCall } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

interface Contact {
  id: string;
  userId: string | null;
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
}
interface Rule {
  id: string;
  thresholdHours: number;
  escalationHours: number | null;
  gracePeriodMinutes: number;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  contactIds: string[];
  active: boolean;
  consentAt: string | null;
}
interface Alert {
  id: string;
  status: string;
  triggeredAt: string;
  acknowledgedAt: string | null;
  deliveries: { id: string; channel: string; status: string }[];
}

export function PatientSafety() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [rule, setRule] = useState<Rule | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(48);
  const [escalation, setEscalation] = useState<number | "">(6);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", relationship: "", userId: "", phone: "", email: "" });
  const [showAddContact, setShowAddContact] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ rule: Rule | null; contacts: Contact[]; alerts: Alert[] }>("/patient/welfare");
      setContacts(data.contacts);
      setAlerts(data.alerts);
      if (data.rule) {
        setRule(data.rule);
        setThreshold(data.rule.thresholdHours);
        setEscalation(data.rule.escalationHours ?? "");
        setSelectedContacts(data.rule.contactIds);
        setConsent(Boolean(data.rule.consentAt));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your safety settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const addContact = async () => {
    if (!newContact.name || !newContact.relationship || !newContact.userId) {
      toast.error("Name, relationship and the contact's platform account ID are required");
      return;
    }
    try {
      const data = await apiClient.post<{ contact: Contact }>("/patient/welfare", {
        action: "addContact",
        contact: { ...newContact, phone: newContact.phone || undefined, email: newContact.email || undefined },
      });
      setContacts((prev) => [...prev, data.contact]);
      setNewContact({ name: "", relationship: "", userId: "", phone: "", email: "" });
      setShowAddContact(false);
      toast.success("Contact added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the contact");
    }
  };

  const removeContact = async (id: string) => {
    try {
      await apiClient.post("/patient/welfare", { action: "removeContact", contactId: id });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContacts((prev) => prev.filter((c) => c !== id));
      toast.success("Contact removed. Monitoring was switched off — save the rule again with a new contact.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the contact");
    }
  };

  const saveRule = async (activate: boolean) => {
    if (selectedContacts.length === 0) {
      toast.error("Choose at least one trusted contact to notify");
      return;
    }
    if (activate && !consent) {
      toast.error("Your explicit consent is required before monitoring can alert your contacts");
      return;
    }
    try {
      const data = await apiClient.put<{ rule: Rule }>("/patient/welfare", {
        thresholdHours: threshold,
        escalationHours: escalation === "" ? null : Number(escalation),
        gracePeriodMinutes: 0,
        active: activate,
        contactIds: selectedContacts,
        consent,
      });
      setRule(data.rule);
      toast.success(activate ? "Inactivity monitoring is on" : "Settings saved (monitoring off)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the settings");
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length >= 2 ? prev : [...prev, id],
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" /> Safety and welfare monitoring
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose trusted contacts to be notified if you have not signed in for a period you set.
        </p>
      </div>

      <Card className="beeline-card">
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">How this works — and its limits</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The only thing monitored is whether you sign in to this platform. Nothing about your messages or health is analysed.</li>
            <li>Lack of activity does NOT mean you missed medication, are unwell, or need help — and this is not an emergency service.</li>
            <li>Alerts are separate from your medication reminders and never include clinical details.</li>
            <li>You can switch monitoring off at any time.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card className="beeline-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">Trusted contacts</p>
            <Button variant="outline" size="sm" onClick={() => setShowAddContact((s) => !s)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Add contact
            </Button>
          </div>
          {contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">No contacts yet. The first contact receives the alert; an optional second contact receives an escalation.</p>
          )}
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                checked={selectedContacts.includes(contact.id)}
                onChange={() => toggleContact(contact.id)}
                aria-label={`Select ${contact.name} as an alert recipient`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.relationship}</p>
              </div>
              <Button variant="ghost" size="sm" aria-label={`Remove ${contact.name}`} onClick={() => removeContact(contact.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {selectedContacts.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Order matters: {contacts.find((c) => c.id === selectedContacts[0])?.name ?? "the first contact"} is notified first.
            </p>
          )}
          {showAddContact && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" value={newContact.name} onChange={(e) => setNewContact((c) => ({ ...c, name: e.target.value }))} /></div>
                <div className="space-y-1"><Label htmlFor="c-rel">Relationship</Label><Input id="c-rel" value={newContact.relationship} onChange={(e) => setNewContact((c) => ({ ...c, relationship: e.target.value }))} placeholder="For example: daughter" /></div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-user">Their Medic1905 account ID</Label>
                <Input id="c-user" value={newContact.userId} onChange={(e) => setNewContact((c) => ({ ...c, userId: e.target.value }))} placeholder="They receive the alert in their account" />
              </div>
              <Button onClick={addContact}>Add contact</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule */}
      <Card className="beeline-card">
        <CardContent className="space-y-4 p-4">
          <p className="font-medium">Monitoring rule</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="threshold">Alert after (hours of inactivity)</Label>
              <select id="threshold" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="escalation">Escalate to the second contact after (hours, optional)</Label>
              <Input id="escalation" type="number" min={1} max={72} value={escalation} onChange={(e) => setEscalation(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>
              I consent to my chosen contacts being told that I have not signed in for the period above. I understand what is
              monitored, who may be contacted, and that no clinical information is shared. I can withdraw this at any time.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveRule(true)} disabled={!consent || selectedContacts.length === 0} data-testid="button-activate-monitoring">
              {rule?.active ? "Update active monitoring" : "Activate monitoring"}
            </Button>
            <Button variant="outline" onClick={() => saveRule(false)}>Save without activating</Button>
          </div>
          {rule?.active && <Badge className="w-fit rounded-lg bg-emerald-600">Monitoring active</Badge>}
        </CardContent>
      </Card>

      {/* Alert history */}
      {alerts.length > 0 && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-medium"><PhoneCall className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Alert history</p>
            {alerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <span className="text-muted-foreground">{new Date(alert.triggeredAt).toLocaleString()}</span>
                <Badge variant="outline" className="rounded-lg">{alert.status.replaceAll("_", " ").toLowerCase()}</Badge>
                <span className="text-xs text-muted-foreground">
                  {alert.deliveries.length} delivery {alert.deliveries.length === 1 ? "attempt" : "attempts"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
}
