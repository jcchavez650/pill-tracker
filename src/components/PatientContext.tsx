"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type PatientLite = {
  id: string;
  name: string;
  email: string;
};

type PatientContextValue = {
  // For a caregiver: the currently-selected patient id (or their own id).
  // For a patient: always their own id.
  patientId: string | null;
  setPatientId: (id: string) => void;
  patients: PatientLite[];
  refreshPatients: () => Promise<void>;
  isCaregiver: boolean;
  selfId: string;
  selfName: string;
};

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({
  selfId,
  selfName,
  isCaregiver,
  children,
}: {
  selfId: string;
  selfName: string;
  isCaregiver: boolean;
  children: React.ReactNode;
}) {
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [patientId, setPatientIdState] = useState<string | null>(
    isCaregiver ? null : selfId
  );

  const setPatientId = useCallback((id: string) => {
    setPatientIdState(id);
    try {
      localStorage.setItem("pt_selected_patient", id);
    } catch {}
  }, []);

  const refreshPatients = useCallback(async () => {
    if (!isCaregiver) return;
    try {
      const res = await fetch("/api/patients");
      if (!res.ok) return;
      const data = await res.json();
      setPatients(data.patients || []);
    } catch {}
  }, [isCaregiver]);

  useEffect(() => {
    if (!isCaregiver) return;
    refreshPatients();
  }, [isCaregiver, refreshPatients]);

  // Choose an initial selection for caregivers once patients load.
  useEffect(() => {
    if (!isCaregiver || patientId) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("pt_selected_patient");
    } catch {}
    if (stored && (stored === selfId || patients.some((p) => p.id === stored))) {
      setPatientIdState(stored);
    } else if (patients.length > 0) {
      setPatientIdState(patients[0].id);
    } else {
      // No patients yet — caregiver manages their own meds by default.
      setPatientIdState(selfId);
    }
  }, [isCaregiver, patients, patientId, selfId]);

  return (
    <PatientContext.Provider
      value={{
        patientId,
        setPatientId,
        patients,
        refreshPatients,
        isCaregiver,
        selfId,
        selfName,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient(): PatientContextValue {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used within PatientProvider");
  return ctx;
}
