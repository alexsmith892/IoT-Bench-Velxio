# Contract DSL — Wave-1 coverage check (end of Pass 4)

Per one-shot-implementation-plan.md Pass 4 (§4, in-scope): a quick check that the
Pass-3 contract DSL covers what the Wave-1 tasks (Tiers A/B/C in
`one-shot-task-bank.md` §2) need, so Stage-3 authoring (Passes 6–10) doesn't hit a
missing assertion. Wave-2 device/display tasks (Tiers D/E/F) are out of scope here.

## Implemented assertions (Pass 3)

| Assertion | Category | Source channel |
|---|---|---|
| `ledBlinks` | frequency | pinEdges (wire-resolved) |
| `pinFrequency` | frequency | pinEdges |
| `pinDutyCycle` | duty | pinEdges |
| `pinIsHigh` / `pinState` | pin-state | pinEdges |
| `edgeOrder` | edge-order | pinEdges |
| `pwmDuty` | pwm-duty | pwmSamples (OCR) |
| `serialMatches` | serial-format | serial (TX) |
| `adcDerivedValue` | adc-value | serial (TX) |
| `serialValue` (split) | serial-value + serial-format | serial (TX) |

Plus the deterministic stimulus inputs: pin drive, ADC step/ramp (Pass 2), and
serial-RX injection (Pass 3).

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
| `persistent_event_counter` | reset + EEPROM + serial | reset isolation + `serialValue` | **EEPROM observable** = Pass 10 |
| `servo_slew_position` | serial + pulse-width decode | `serialMatches` | **pulse-width/servo-angle** assertion |
| `binary_framed_protocol` | serial RX/TX + pins/PWM | serial-RX + `serialMatches` + `pwmDuty` | binary-byte matching is regex-on-Latin1 (works, a touch awkward) |
| `software_pwm_fade` | pin freq + duty over windows | `pinFrequency` + `pinDutyCycle` | — |
| `cooperative_scheduler` | multi-pin freq + responsiveness | `pinFrequency` per pin + `pinState{window}` | — |

## Gaps to close before they block authoring

1. **EEPROM observable** — `persistent_event_counter` (Pass 10) and the Wave-1
   integration tasks (`water_tank_controller`) need EEPROM readout + a write-count
   observable. Explicitly scheduled in Pass 10; not a Pass-3/4 miss.
2. **Pulse-width / servo-angle assertion** — `servo_slew_position` (Pass 9) needs
   to decode a servo pulse's HIGH time → angle. Derivable from `pinEdges`
   (latestHighMs already exists in `digitalTiming`), but wants a dedicated
   `pulseWidth(pin,{usHigh,tol})` / `servoAngle` builder. **Add in Pass 9.**
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
already scheduled (EEPROM → Pass 10, buzzer → Pass 15) or small per-task helpers
to add at the authoring pass that first needs them (servo pulse-width → Pass 9,
7-seg → Pass 6). No gap blocks starting Stage 3.
