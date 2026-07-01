// binary_framed_protocol — adversarial wrong "no-resync".
// Verifies checksums but does NOT reject LEN>16: it accepts any length and tries to
// read LEN+1 bytes, so an oversized bad frame swallows the bytes of the following
// valid frame and never recovers. Fails the recovery variant — the expected success
// response for the next valid frame never appears (`serial-format`).

const int LED_PIN = 7;
const int PWM_PIN = 3;

uint8_t ledState = 0;
uint8_t pwmState = 0;

enum { WAIT_START, READ_LEN, READ_DATA };
int state = WAIT_START;
uint8_t buf[20];
int len = 0;
int idx = 0;

void sendFrame(uint8_t cmd, const uint8_t* payload, int plen) {
  uint8_t l = plen + 1;
  uint8_t chk = l ^ cmd;
  Serial.write(0x55);
  Serial.write(l);
  Serial.write(cmd);
  for (int i = 0; i < plen; i++) { Serial.write(payload[i]); chk ^= payload[i]; }
  Serial.write(chk);
}

void sendNak(uint8_t err) { sendFrame(0x7F, &err, 1); }

void processFrame() {
  uint8_t chk = len;
  for (int i = 0; i < len; i++) chk ^= buf[i];
  if (chk != buf[len]) { sendNak(1); return; }
  uint8_t cmd = buf[0];
  int plen = len - 1;
  if (cmd == 0x01) {
    if (plen != 1 || (buf[1] != 0 && buf[1] != 1)) { sendNak(2); return; }
    ledState = buf[1];
    digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    sendFrame(0x01, &buf[1], 1);
  } else if (cmd == 0x02) {
    if (plen != 1) { sendNak(2); return; }
    pwmState = buf[1];
    analogWrite(PWM_PIN, pwmState);
    sendFrame(0x02, &buf[1], 1);
  } else if (cmd == 0x03) {
    if (plen != 0) { sendNak(2); return; }
    uint8_t p[2] = { ledState, pwmState };
    sendFrame(0x03, p, 2);
  } else {
    sendNak(2);
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(PWM_PIN, OUTPUT);
  analogWrite(PWM_PIN, 0);
  Serial.begin(115200);
}

void loop() {
  while (Serial.available()) {
    uint8_t c = Serial.read();
    switch (state) {
      case WAIT_START:
        if (c == 0xAA) state = READ_LEN;
        break;
      case READ_LEN:
        len = c;  // BUG: no LEN>16 rejection
        idx = 0;
        state = READ_DATA;
        break;
      case READ_DATA:
        if (idx < 20) buf[idx] = c;
        idx++;
        if (idx == len + 1) { processFrame(); state = WAIT_START; }
        break;
    }
  }
}
