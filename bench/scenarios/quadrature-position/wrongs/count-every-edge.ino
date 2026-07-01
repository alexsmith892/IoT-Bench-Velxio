// quadrature_position — adversarial wrong "count-every-edge".
// Naively increments the position on EVERY channel transition and prints a line,
// instead of one line per completed 4-state detent. Over-counts by ~4× and prints
// intermediate transitions, so the reported POS is wrong. Fails `serial-value`.

const int A_PIN = 2;
const int B_PIN = 3;

int lastA = HIGH, lastB = HIGH;
long pos = 0;

void setup() {
  pinMode(A_PIN, INPUT_PULLUP);
  pinMode(B_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  lastA = digitalRead(A_PIN);
  lastB = digitalRead(B_PIN);
}

void loop() {
  int a = digitalRead(A_PIN);
  int b = digitalRead(B_PIN);
  if (a != lastA || b != lastB) {
    pos++;  // BUG: counts every edge, not one per detent
    Serial.print("POS=");
    Serial.print(pos);
    Serial.println(" DIR=CW");
    lastA = a;
    lastB = b;
  }
}
