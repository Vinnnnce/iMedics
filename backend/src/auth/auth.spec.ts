import { describe, it, expect } from '@jest/globals';
import { ROLES, Role } from './auth.service';

describe('AuthModule', () => {
  it('should define all four roles', () => {
    expect(ROLES).toHaveLength(4);
    expect(ROLES).toContain('PATIENT');
    expect(ROLES).toContain('DOCTOR');
    expect(ROLES).toContain('LAB_SCIENTIST');
    expect(ROLES).toContain('ADMIN');
  });

  it('should have correct Role type values', () => {
    const patient: Role = 'PATIENT';
    const doctor: Role = 'DOCTOR';
    const labScientist: Role = 'LAB_SCIENTIST';
    const admin: Role = 'ADMIN';

    expect(patient).toBe('PATIENT');
    expect(doctor).toBe('DOCTOR');
    expect(labScientist).toBe('LAB_SCIENTIST');
    expect(admin).toBe('ADMIN');
  });
});
