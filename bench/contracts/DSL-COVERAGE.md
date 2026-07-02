# Contract DSL — Wave-1 coverage check (end of Pass 4)

Per one-shot-implementation-plan.md Pass 4 (§4, in-scope): a quick check that the
Pass-3 contract DSL covers what the Wave-1 tasks (Tiers A/B/C in
`one-shot-task-bank.md` §2) need, so Stage-3 authoring (Passes 6–10) doesn't hit a
missing assertion. Wave-2 device/display tasks (Tiers D/E/F) are out of scope here.

## Implemented assertions (Pass 3)

| Assertion | Category | Source channel |
|---|---|---|
| `ledBlinks` | frequency | pinEdges (wire-resolved) |
| `pinFrequency` (opt. `window`) | frequency | pinEdges |
| `pinDutyCycle` (opt. `window`) | duty | pinEdges |
| `pinIsHigh` / `pinState` | pin-state | pinEdges |
| `edgeOrder` | edge-order | pinEdges |
| `pwmDuty` | pwm-duty | pwmSamples (OCR) |
| `serialMatches` | serial-format | serial (TX) |
| `serialAbsent` | serial-format | serial (TX) |
| `adcDerivedValue` | adc-value | serial (TX) |
| `serialValue` (split) | serial-value + serial-format | serial (TX) |
| `eepromByte` | eeprom | eepromSnapshot |
| `eepromWriteCount` | eeprom-write | eepromWrites |
| `maxFlashBytes` / `maxRamBytes` | compile-size | compile meta |

Plus the deterministic stimulus inputs: pin drive, ADC step/ramp (Pass 2), and
serial-RX injection (Pass 3).

**Pass 6 addition:** `maxFlashBytes`/`maxRamBytes` (compile-size, §7 near-budget).
**Pass 8 additions:** an optional measurement `window` on `pinFrequency`/
`pinDutyCycle` (per-mode/segment frequency, e.g. `four_mode_indicator`; reused by
Pass 9's `software_pwm_fade`/`cooperative_scheduler`), and `serialAbsent` (the
negative format check — "no FALSE_START", "no STATE=DONE after abort").
**Pass 9 additions:** `pulseWidth`/`servoAngle` (category `pulse-width`) decode a
periodic pulse train's HIGH width → µs/angle from `pinEdges` (`servo_slew_position`);
`edgeCount` (category `edge-count`) bounds transitions in a window (the
`cooperative_scheduler` "no catch-up edges while paused" freeze check); and
`serialBytesInclude` (category `serial-format`) matches an exact binary response
frame as a byte subsequence over the Latin-1 TX stream (`binary_framed_protocol`).
**Pass 10 additions:** `eepromByte` / `eepromWriteCount` (categories `eeprom` /
`eeprom-write`) read the post-run EEPROM snapshot and bound firmware write events in
the trace; stimulus kinds `eepromSeed` and `reset` (simulated MCU reboot preserving
EEPROM with monotonic trace time); optional `window` on `serialMatches` for
post-reset / segmented STATUS checks.

## Per-task mapping (Wave-1, Tiers A/B/C)

| Task | Needs | Covered by | Gap |
|---|---|---|---|
| `active_low_interlock` | pin state | `pinState` | — |
| `dual_input_safety_enable` | pins (logic) | `pinState`, `edgeOrder` | — |
| `tmp36_calibrated_report` | ADC + serial value/format | `serialValue` | — |
| `potentiometer_pwm_map` | ADC → PWM duty | `pwmDuty` + `adcDerivedValue` | — |
| `hex_dip_to_7segment` | pins → digit | `pinState` ×7 | **7-seg decode helper** (nice-to-have) |
| `responsive_dual_scheduler` | timed pin edges | `pinFrequency`, `pinState{window}` | — |
| `debounced_toggle` | scheduled pin input | `pinState`, `edgeOrder` | — |
| `light_alarm_hysteresis` | ADC + pin | `pinState` + ADC stimulus | — |
| `rolling_adc_average` | ADC + serial value | `serialValue` | — |
| `integer_overflow_accumulator` | serial RX/TX numeric | serial-RX inject + `serialValue` | — |
| `serial_control_protocol` | serial RX/TX + pins/PWM | `serialMatches` + `pinState` + `pwmDuty` | — |
| `four_mode_indicator` | button + edges + buzzer | `pinState`/`edgeOrder` (modes) | **buzzer-frequency** = Wave-2 (Pass 15) |
| `quadrature_position` | A/B edges + serial | `edgeOrder` + `adcDerivedValue` | — |
| `reaction_timer_fsm` | pins + serial (timing value) | `pinState` + `serialValue` | — |
| `appliance_cycle_fsm` | pins + serial | `pinState`/`edgeOrder` + `serialMatches` | — |
| `persistent_event_counter` | reset + EEPROM + serial | `eepromByte`, `eepromWriteCount`, `reset` stimulus + `serialValue` | — |
| `water_tank_controller` | ADC + pins + EEPROM + serial | `pinState` + `eepromWriteCount` + `serialMatches` | — |
| `zone_climate_controller` | dual ADC + pins + serial | `pinState` + `adcDerivedValue` + `serialMatches` | — |
| `servo_slew_position` | serial + pulse-width decode | `serialMatches` | **pulse-width/servo-angle** assertion |
| `binary_framed_protocol` | serial RX/TX + pins/PWM | serial-RX + `serialMatches` + `pwmDuty` | binary-byte matching is regex-on-Latin1 (works, a touch awkward) |
| `software_pwm_fade` | pin freq + duty over windows | `pinFrequency` + `pinDutyCycle` | — |
| `cooperative_scheduler` | multi-pin freq + responsiveness | `pinFrequency` per pin + `pinState{window}` | — |

## Gaps to close before they block authoring

1. **EEPROM observable** — ✅ **CLOSED (Pass 10).** `eepromByte`, `eepromWriteCount`,
   `eepromSeed`/`reset` stimulus, and `AVREEPROM` in the headless harness. Graded by
   `persistent_event_counter` and `water_tank_controller`.
2. **Pulse-width / servo-angle assertion** — ✅ **CLOSED (Pass 9).** `pulseWidth`
   and `servoAngle` (category `pulse-width`) decode a pulse train's HIGH width →
   µs/angle from `pinEdges`. Used by `servo_slew_position`.
3. **Buzzer/tone frequency** — `four_mode_indicator` (Pass 8) and integration
   tasks. `tone()` drives the pin via Timer2 toggle; needs the buzzer-frequency
   observer scheduled for Wave-2 Pass 15. The non-buzzer parts grade now; gate the
   buzzer contract only once that observer lands.
4. **`edgeCount` / `maxFlashBytes`** (design §4 DSL): not yet built. `edgeOrder`
   covers most ordering needs; `edgeCount` is a small add when first needed. The
   compile-size (`maxFlashBytes`) needs `compile.flashBytes` on the Trace — a
   cross-cutting near-budget-variant item (Pass 7+), not Wave-1-blocking.
5. **7-segment decode** (`hex_dip_to_7segment`, Pass 6): gradeable today as 7
   `pinState` assertions per displayed digit, but a `sevenSegDigit` helper would
   make authoring far cleaner. Nice-to-have; decide in Pass 6.

**Verdict:** the Pass-3 DSL covers the pin/timing/PWM/serial/value-format core
that the bulk of Wave-1 (Tiers A/B) needs. The remaining gaps are all either
already scheduled (buzzer → Pass 15) or small per-task helpers
to add at the authoring pass that first needs them (servo pulse-width → Pass 9,
7-seg → Pass 6). No gap blocks starting Stage 3.
