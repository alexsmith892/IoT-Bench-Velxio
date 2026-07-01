// quadrature_position (OS-D3-02) — reference solution.
// Decode a mechanical detented quadrature encoder: channel A on D2, B on D3, both
// INPUT_PULLUP. At rest both read HIGH (state 11). Clockwise is defined as: from
// A=1 B=1, A goes low first (→ A=0 B=1). One detent = one complete 4-state cycle
// back to 11: +1 / DIR=CW clockwise, -1 / DIR=CCW the reverse. Invalid (two-bit)
// transitions and contact bounce are rejected by a Gray-code transition table
// (illegal steps contribute 0; a bounce nets to zero). Print exactly one line per
// completed valid detent; nothing for intermediate or invalid/bouncing sequences.

const int A_PIN = 2;
const int B_PIN = 3;

// (oldState<<2)|newState → sub-step: +1/-1 for a legal Gray transition, 0 otherwise.
const int8_t STEP[16] = { 0, -1, +1, 0, +1, 0, 0, -1, -1, 0, 0, +1, 0, +1, -1, 0 };

int lastState = 0b11;
int subCount = 0;
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
    subCount += STEP[(lastState << 2) | s];
    lastState = s;
    if (s == 0b11) {  // back at a detent position
      if (subCount >= 4) {
        pos++;
        Serial.print("POS=");
        Serial.print(pos);
        Serial.println(" DIR=CW");
      } else if (subCount <= -4) {
        pos--;
        Serial.print("POS=");
        Serial.print(pos);
        Serial.println(" DIR=CCW");
      }
      subCount = 0;  // reset at every detent (incomplete/bouncing cycles net out)
    }
  }
}
