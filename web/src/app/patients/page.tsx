"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { calculateBMI, getBMIColor } from "@/lib/bmi";
import { apiClient } from "@/lib/api-client";
import { Plus, Search, Users, FileText } from "lucide-react";
import type { Prisma } from "@prisma/client";

type Patient = Prisma.PatientGetPayload<{}>;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients(searchQuery?: string) {
    setLoading(true);
    try {
      const query = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const data = await apiClient.get<{ patients: Patient[]; total: number }>(
        `/patients${query}`
      );
      setPatients(data.patients);
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPatients(search);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">
            Manage patient records and medical histories
          </p>
        </div>
        <Link href="/patients/new">
          <Button className="gap-1.5" data-testid="button-new-patient">
            <Plus className="h-4 w-4" />
            New Patient
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or case number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-patient-search"
              />
            </div>
            <Button type="submit" variant="secondary" data-testid="button-search">
              Search
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading patients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No patients found. Create a new patient to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case Number</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>BMI</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => {
                  const bmiResult = calculateBMI(patient.height, patient.weight);
                  return (
                    <TableRow key={patient.id} data-testid={`row-patient-${patient.id}`}>
                      <TableCell className="font-mono text-xs">
                        {patient.caseNumber}
                      </TableCell>
                      <TableCell className="font-medium">
                        {patient.lastName}, {patient.firstName}
                        {patient.middleName ? ` ${patient.middleName}` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {patient.dateOfBirth
                          ? new Date(patient.dateOfBirth).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {patient.gender}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {bmiResult ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {bmiResult.value}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-medium ${getBMIColor(
                                bmiResult.category
                              )}`}
                            >
                              {bmiResult.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/patients/${patient.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-patient-detail-${patient.id}`}
                            >
                              Detail
                            </Button>
                          </Link>
                          <Link href={`/patients/${patient.id}/history`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-patient-history-${patient.id}`}
                            >
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              History
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
