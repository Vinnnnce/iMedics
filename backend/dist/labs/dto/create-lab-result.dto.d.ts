declare class LabValueDto {
    code: string;
    loinc?: string;
    name: string;
    value: number;
    unit: string;
    refLow?: number;
    refHigh?: number;
}
export declare class CreateLabResultDto {
    panelType: string;
    testDate: string;
    labName?: string;
    values: LabValueDto[];
}
export {};
