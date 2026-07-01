// WRONG (responsive_dual_scheduler): a BLOCKING scheduler built on delay(250).
// The blink frequencies come out right (A toggles every 500 ms, B every 250 ms),
// but the button is only sampled once per 250 ms delay, so the response LED lags
// far beyond the 20 ms responsiveness window. This is the behavioral non-blocking
// enforcer: it fails the pin-state (D8) contract, not a source check.
// expectFailCategory: pin-state.

const int LED_A = 3;
const int LED_B = 5;
const int RESP  = 8;
const int BTN   = 2;

bool aOn = false, bOn = false;
unsigned int tick = 0;

void setup() {
  pinMode(LED_A, OUTPUT);
  pinMode(LED_B, OUTPUT);
  pinMode(RESP, OUTPUT);
  pinMode(BTN, INPUT_PULLUP);
  digitalWrite(LED_A, LOW);
  digitalWrite(LED_B, LOW);
  digitalWrite(RESP, LOW);
}

void loop() {
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW); // sampled once per 250 ms
  bOn = !bOn; digitalWrite(LED_B, bOn);            // 2 Hz
  if (tick % 2 == 1) { aOn = !aOn; digitalWrite(LED_A, aOn); } // 1 Hz
  tick++;
  delay(250); // blocks the button response
}
