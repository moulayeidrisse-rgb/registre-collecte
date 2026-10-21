"use client";

import { useActionState, useState } from "react";
import { reviewAction, type ReviewState } from "../actions";
import { Alert, Button, Label, inputClass } from "@/components/ui";
import { useToast } from "@/components/toast";

export function ReviewForm({ submissionId, warningCount }: { submissionId: string; warningCount: number }) {
  const toast = useToast();
  // Après une décision, ce bloc disparaît (la réponse n'est plus « en attente ») :
  // la confirmation passe donc par une notification, qui reste visible.
  const [state, action, pending] = useActionState<ReviewState, FormData>(async (prev, fd) => {
    const r = await reviewAction(submissionId, prev, fd);
    if (r?.ok && r.message) toast("success", r.message);
    return r;
  }, null);
  const [decision, setDecision] = useState("");
  return (
    <form action={action} className="space-y-3 p-5" onSubmit={(e) => {
      const d = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
      if (d === "REJETER" && !window.confirm("Rejeter définitivement cette réponse ?")) e.preventDefault();
    }}>
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {warningCount > 0 && <Alert tone="warning">Cette réponse comporte {warningCount} avertissement(s). Vérifiez-les avant de valider.</Alert>}
      <div>
        <Label htmlFor="comment">Commentaire {decision && decision !== "VALIDER" ? "(obligatoire)" : "(obligatoire pour rejeter ou renvoyer)"}</Label>
        <textarea id="comment" name="comment" rows={3} maxLength={1000} className={inputClass} aria-invalid={Boolean(state?.fieldErrors?.comment)} />
        {state?.fieldErrors?.comment && <p className="mt-1 text-sm text-red-700">{state.fieldErrors.comment[0]}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="VALIDER" variant="success" disabled={pending} onClick={() => setDecision("VALIDER")}>Valider</Button>
        <Button type="submit" name="decision" value="A_CORRIGER" variant="secondary" disabled={pending} onClick={() => setDecision("A_CORRIGER")}>Renvoyer pour correction</Button>
        <Button type="submit" name="decision" value="REJETER" variant="danger" disabled={pending} onClick={() => setDecision("REJETER")}>Rejeter</Button>
      </div>
    </form>
  );
}
