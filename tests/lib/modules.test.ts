import { readModuleState, saveModuleState } from "@/lib/modules";
import { describe, expect, it } from "vitest";

describe("modules", () => {
    it("reads default state", () => {
        const initialState = readModuleState();
        expect(initialState).toEqual({ contas: true, inventario: true })
    })
    
    it("writes and reads state from localStorage", () => {
        const state = { contas: false, inventario: true };
        saveModuleState(state);
        const readState = readModuleState();
        expect(readState).toEqual(state);
    })
})