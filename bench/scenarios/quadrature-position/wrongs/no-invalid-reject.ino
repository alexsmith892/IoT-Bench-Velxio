// quadrature_position — adversarial wrong "no-invalid-reject".
// Emits a detent on every return to the rest state 11, using only the FIRST
// transition's direction — it does NOT validate the Gray-code sequence, so it
// counts invalid two-bit jumps and incomplete wiggles as detents. Fails the
// invalid-rejection variant (it prints POS lines that must not appear) →
// `serial-format`.

const int A_PIN = 2;
const int B_PIN = 3;

int lastState = 0b11;
bool moving = false;
int firstDir = 0;
long pos = 0;

int readState() {
  return (digitalRead(A_PIN) << 1) | digitalRead(B_PIN);
}

void setup() {
  pinMode(A_PIN, INPUT_PULLUP);
  pinMode(B_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  lastState = readState();
}

void loop() {
  int s = readState();
  if (s != lastState) {
    if (!moving && lastState == 0b11) {
      // leaving the detent: guess direction from the first step only (no validation)
      firstDir = (s == 0b01 || s == 0b00) ? +1 : -1;
      moving = true;
    }
    if (s == 0b11 && moving) {
      pos += firstDir;
      Serial.print("POS=");
      Serial.print(pos);
      Serial.println(firstDir > 0 ? " DIR=CW" : " DIR=CCW");
      moving = false;
    }
    lastState = s;
  }
}
