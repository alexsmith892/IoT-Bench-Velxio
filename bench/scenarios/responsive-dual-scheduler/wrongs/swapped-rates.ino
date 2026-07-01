// WRONG (responsive_dual_scheduler): non-blocking and responsive, but the two
// blink RATES are swapped — LED A runs at 2 Hz and LED B at 1 Hz. The button
// mirror is fine, so it fails only on the frequency contract. expectFailCategory:
// frequency.

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
  if (now - tA >= 250) { tA = now; aOn = !aOn; digitalWrite(LED_A, aOn); } // wrong: 2 Hz
  if (now - tB >= 500) { tB = now; bOn = !bOn; digitalWrite(LED_B, bOn); } // wrong: 1 Hz
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW);
}
