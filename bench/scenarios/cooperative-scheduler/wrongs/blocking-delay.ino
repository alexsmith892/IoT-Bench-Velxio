// cooperative_scheduler — adversarial wrong "blocking-delay".
// Uses a millis scheduler for the blinks (roughly correct) but ends every loop
// with delay(50) "to pace it", so the button→D8 mirror is only serviced every
// ~50 ms and lags a press well beyond the 20 ms responsiveness bound. Fails the
// `pin-state` mirror contract.

const int LED[4] = { 4, 5, 6, 7 };
const unsigned long HALF_MS[4] = { 500, 250, 167, 100 };
const int BTN = 2;
const int RESP = 8;

unsigned long t0 = 0;

void setup() {
  for (int i = 0; i < 4; i++) { pinMode(LED[i], OUTPUT); digitalWrite(LED[i], LOW); }
  pinMode(BTN, INPUT_PULLUP);
  pinMode(RESP, OUTPUT);
  digitalWrite(RESP, LOW);
  Serial.begin(115200);
  t0 = millis();
}

void loop() {
  unsigned long el = millis() - t0;
  for (int i = 0; i < 4; i++) {
    unsigned long ph = el % (2 * HALF_MS[i]);
    digitalWrite(LED[i], ph < HALF_MS[i] ? LOW : HIGH);
  }
  digitalWrite(RESP, digitalRead(BTN) == LOW ? HIGH : LOW);

  if (Serial.available()) {
    String s = Serial.readStringUntil('\n');
    s.trim();
    if (s == "PAUSE") Serial.println("OK PAUSED");
    else if (s == "RESUME") Serial.println("OK RUNNING");
    else Serial.println("ERR");
  }
  delay(120);  // BUG: blocks the loop, so the button mirror lags far past 20 ms
}
