// responsive_dual_scheduler (OS-D2-01) — reference solution.
// Three concurrent behaviours, non-blocking:
//   - LED A (D3): 1 Hz, 50% duty  → toggle every 500 ms
//   - LED B (D5): 2 Hz, 50% duty  → toggle every 250 ms
//   - Response LED (D8): mirrors the button (D2, INPUT_PULLUP) within 20 ms while
//     both blink patterns continue uninterrupted.
// All three outputs start LOW.

const int LED_A = 3;
const int LED_B = 5;
const int RESP  = 8;
const int BTN   = 2;

unsigned long tA = 0, tB = 0;
bool aOn = false, bOn = false;

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
  unsigned long now = millis();
  if (now - tA >= 500) { tA = now; aOn = !aOn; digitalWrite(LED_A, aOn); }
  if (now - tB >= 250) { tB = now; bOn = !bOn; digitalWrite(LED_B, bOn); }
  // Runs every loop iteration (microseconds) → button mirrored well within 20 ms.
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW);
}
