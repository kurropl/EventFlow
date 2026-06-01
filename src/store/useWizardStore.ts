/**
 * EventFlow — Wizard Zustand Store
 *
 * Manages the multi-step wizard state with:
 * - Step navigation (currentStep 1-5)
 * - Step data persistence (step1-step4)
 * - Client info collection
 * - Menu selection
 * - B2C: selections WITHOUT prices in store
 * - B2B: calculated totals (PVP, cost, margin)
 * - localStorage persistence via persist middleware
 * - API submission with automatic store reset
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import {
  WizardStep1,
  WizardStep2,
  WizardStep3,
  WizardStep4,
  WizardStep1Schema,
  WizardStep2Schema,
  WizardStep3Schema,
  WizardStep4Schema,
  SelectedItem,
  CatalogItem,
  EventSetupCreate,
} from '@/types/specs';

// ============================================================
// Types
// ============================================================

export type WizardMode = 'b2c' | 'b2b';

interface WizardState {
  // ---- Step data ----
  step1: WizardStep1 | null;
  step2: WizardStep2 | null;
  step3: WizardStep3 | null;
  step4: WizardStep4 | null;

  // ---- Client info (collected at step 5) ----
  clientInfo: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };

  // ---- Catalog & selections ----
  catalogItems: CatalogItem[];
  selectedItems: SelectedItem[];

  // ---- Mode ----
  mode: WizardMode;

  // ---- Selected menu ----
  selectedMenu: string | null;

  // ---- Calculated totals (B2B only — never shown in B2C wizard) ----
  totalPvp: number;
  totalCost: number;

  // ---- UI state ----
  currentStep: number;
  readonly totalSteps: number;
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;

  // ---- Actions ----
  nextStep: () => void;
  previousStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  setStepData: <T extends keyof WizardState>(
    step: T,
    data: WizardState[T]
  ) => void;
  reset: () => void;
  submit: () => Promise<{ success: boolean; eventId?: string }>;

  // Client info actions
  setClientInfo: (info: Partial<WizardState['clientInfo']>) => void;

  // Catalog & selections
  setCatalogItems: (items: CatalogItem[]) => void;
  setSelectedItems: (items: SelectedItem[]) => void;

  // Mode
  setMode: (mode: WizardMode) => void;

  // Menu
  setSelectedMenu: (menuId: string | null) => void;

  // Totals (B2B)
  setTotals: (pvp: number, cost: number) => void;

  // UI
  startSubmission: () => void;
  finishSubmission: () => void;
  setSubmissionError: (error: string | null) => void;
  setSubmissionSuccess: () => void;
}

// ============================================================
// Store
// ============================================================

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      // ---- Initial state ----
      step1: null,
      step2: null,
      step3: null,
      step4: null,
      clientInfo: { name: '', email: '', phone: '', notes: '' },
      catalogItems: [],
      selectedItems: [],
      mode: 'b2c',
      selectedMenu: null,
      totalPvp: 0,
      totalCost: 0,
      currentStep: 1,
      totalSteps: 5,
      isSubmitting: false,
      submitError: null,
      submitSuccess: false,

      // ---- Step navigation ----
      nextStep: () => {
        const { currentStep } = get();
        if (currentStep < 5) {
          set({ currentStep: currentStep + 1 });
        }
      },

      previousStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
        }
      },

      setStep: (step) => {
        const clamped = Math.max(1, Math.min(5, step));
        set({ currentStep: clamped });
      },

      // ---- Step data setters (with Zod validation) ----
      setStepData: <T extends keyof WizardState>(step: T, data: WizardState[T]) => {
        switch (step) {
          case 'step1': {
            const validated = WizardStep1Schema.parse(data);
            set({ step1: validated });
            break;
          }
          case 'step2': {
            // Accept both menu_id and selected_menu for flexibility.
            // Empty strings are coerced to undefined so optional fields
            // (kid_menu_id, selected_menu) don't fail the `.min(1)` rule.
            const raw = data as Record<string, unknown>;
            const emptyToUndefined = (v: unknown) =>
              typeof v === 'string' && v.trim() === '' ? undefined : v;
            const validated = WizardStep2Schema.parse({
              menu_id: emptyToUndefined(raw.menu_id ?? raw.selected_menu),
              selected_menu: emptyToUndefined(raw.selected_menu),
              use_proposed: raw.use_proposed ?? true,
              kid_menu_id: emptyToUndefined(raw.kid_menu_id),
            });
            set({ step2: validated });
            break;
          }
          case 'step3': {
            const validated = WizardStep3Schema.parse(data);
            set({ step3: validated });
            break;
          }
          case 'step4': {
            // Accept both selected_suggestions and suggestions
            const raw = data as Record<string, unknown>;
            const validated = WizardStep4Schema.parse({
              selected_suggestions: raw.selected_suggestions ?? raw.suggestions ?? [],
              suggestions: raw.suggestions ?? raw.selected_suggestions ?? [],
              bar_hours: raw.bar_hours ?? 0,
            });
            set({ step4: validated });
            break;
          }
          default:
            set({ [step]: data });
            break;
        }
      },

      // ---- Client info ----
      setClientInfo: (info) => {
        set((state) => ({
          clientInfo: { ...state.clientInfo, ...info },
        }));
      },

      // ---- Catalog & selections ----
      setCatalogItems: (items) => set({ catalogItems: items }),

      setSelectedItems: (items) => {
        set({ selectedItems: items });
      },

      // ---- Mode ----
      setMode: (mode) => set({ mode }),

      // ---- Menu ----
      setSelectedMenu: (menuId) => set({ selectedMenu: menuId }),

      // ---- Totals (B2B only) ----
      setTotals: (pvp, cost) => set({ totalPvp: pvp, totalCost: cost }),

      // ---- Submission ----
      startSubmission: () =>
        set({ isSubmitting: true, submitError: null, submitSuccess: false }),

      finishSubmission: () => set({ isSubmitting: false }),

      setSubmissionError: (error) => set({ submitError: error }),

      setSubmissionSuccess: () => set({ submitSuccess: true }),

      // ---- Submit: create event via API and reset store ----
      submit: async () => {
        const state = get();

        // Validate all required steps
        if (!state.step1) {
          set({ submitError: 'Step 1 (event details) is required' });
          return { success: false };
        }
        if (!state.step2) {
          set({ submitError: 'Step 2 (menu selection) is required' });
          return { success: false };
        }
        // Step 3: items required UNLESS using a proposed menu
        const hasProposedMenu = state.step2?.use_proposed === true && state.step2?.menu_id;
        const hasItems = (state.step3 as any)?.selected_items?.length > 0;
        if (!hasProposedMenu && !hasItems) {
          set({ submitError: 'Step 3 (item selection) requires at least one item' });
          return { success: false };
        }
        if (!state.step4) {
          set({ submitError: 'Step 4 (extras) is required' });
          return { success: false };
        }
        if (!state.clientInfo.name || !state.clientInfo.email) {
          set({ submitError: 'Client name and email are required' });
          return { success: false };
        }

        set({ isSubmitting: true, submitError: null, submitSuccess: false });

        try {
          // B2C: selections are stored WITHOUT prices
          // B2B: selections include calculated totals (PVP, cost, margin)
          // Prices are always calculated server-side using catalog_item.pvp and catalog_item.cost

          // step3 may be null when a proposed menu is used without
          // customisation — fall back to an empty list so we never crash.
          const rawSelectedItems: any[] = (state.step3 as any)?.selected_items ?? [];
          const selectedItemsPayload = state.mode === 'b2c'
            ? rawSelectedItems.map((item: any) => ({
                item_id: item.item_id,
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                // B2C: no prices in the payload
                unit_price_pvp: 0,
                unit_price_cost: 0,
                subtotal_pvp: 0,
                subtotal_cost: 0,
              }))
            : rawSelectedItems;

          // Calculate real prices from catalog for B2C
          let totalPvp = 0;
          let totalCost = 0;
          if (state.mode === 'b2c' && selectedItemsPayload.length > 0) {
            try {
              const catRes = await fetch('/api/catalog');
              const catData = await catRes.json();
              if (catData.success && catData.data) {
                const allItems = Object.values(catData.data).reduce((acc: any[], items: any[]) => {
                  acc.push(...items);
                  return acc;
                }, []);
                for (const item of selectedItemsPayload) {
                  const catItem = allItems.find((c: any) => c.id === item.item_id);
                  if (catItem) {
                    const pvp = Number(catItem.pvp) || 0;
                    const cost = Number(catItem.cost) || 0;
                    const qty = Number(item.quantity) || 1;
                    totalPvp += pvp * qty;
                    totalCost += cost * qty;
                  }
                }
              }
            } catch (e) {
              console.error('[Wizard] Failed to fetch catalog for price calc:', e);
            }
          }

          const payload: EventSetupCreate = {
            client_name: state.clientInfo.name,
            client_email: state.clientInfo.email,
            client_phone: state.clientInfo.phone || undefined,
            event_type: state.step1.event_type,
            guest_count: state.step1.guest_count,
            kids_count: state.step1.kids_count,
            event_date: state.step1.event_date,
            status: 'draft',
            selected_items: selectedItemsPayload,
            total_pvp: state.mode === 'b2b' ? state.totalPvp : totalPvp,
            total_cost: state.mode === 'b2b' ? state.totalCost : totalCost,
          bar_hours: state.step4.bar_hours,
          bar_price: 0,
          iva_pct: 10,
          notes: state.clientInfo.notes || undefined,
        };

          const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            const errorMsg =
              result?.error ?? result?.details ?? 'Failed to create event';
            throw new Error(errorMsg);
          }

          // Success: stay on step 5 so the confirmation screen is shown.
          // Underlying step data is cleared, but WizardStep5 returns the
          // success view early based on `submitSuccess`.
          set({
            submitSuccess: true,
            step1: null,
            step2: null,
            step3: null,
            step4: null,
            clientInfo: { name: '', email: '', phone: '', notes: '' },
            selectedItems: [],
            totalPvp: 0,
            totalCost: 0,
            currentStep: 5,
            isSubmitting: false,
            submitError: null,
            selectedMenu: null,
          });

          return { success: true, eventId: result.data?.id };
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown submission error';
          set({
            isSubmitting: false,
            submitError: errorMsg,
            submitSuccess: false,
          });
          return { success: false };
        }
      },

      // ---- Reset entire wizard ----
      reset: () =>
        set({
          step1: null,
          step2: null,
          step3: null,
          step4: null,
          clientInfo: { name: '', email: '', phone: '', notes: '' },
          selectedItems: [],
          mode: 'b2c',
          selectedMenu: null,
          totalPvp: 0,
          totalCost: 0,
          currentStep: 1,
          isSubmitting: false,
          submitError: null,
          submitSuccess: false,
        }),
    }),
    {
      name: 'eventflow-wizard',
      // Persist only wizard step data, not totals (B2B) or client info
      partialize: (state) => ({
        step1: state.step1,
        step2: state.step2,
        step3: state.step3,
        step4: state.step4,
        currentStep: state.currentStep,
      }),
      // On rehydration, validate data and reset if corrupt
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        try {
          if (state.step1) WizardStep1Schema.parse(state.step1);
          if (state.step2) WizardStep2Schema.parse(state.step2);
          if (state.step3) WizardStep3Schema.parse(state.step3);
          if (state.step4) WizardStep4Schema.parse(state.step4);
        } catch {
          // Data is corrupt (e.g., persisted with different schema) → reset
          state.reset();
        }
      },
    }
  )
);
