// binary_framed_protocol (OS-D3-07) — reference solution.
// Binary protocol @115200, no text. Request: 0xAA, LEN, CMD, PAYLOAD..., CHECKSUM.
// LEN = bytes from CMD through end of PAYLOAD (>=1); CHECKSUM = XOR of LEN, CMD and
// every payload byte. Parse incrementally (arbitrary gaps, garbage before start,
// a bad frame must not block the next). Reject LEN>16. Commands: 0x01 set LED (D7)
// from 1 payload byte 0/1; 0x02 set PWM (D3) from 1 payload byte; 0x03 report
// LED,PWM (no payload). Success: 0x55, LEN, CMD, PAYLOAD..., CHECKSUM (same rules).
// On bad checksum / bad length / unknown cmd / wrong payload: outputs unchanged and
// NAK 0x55,0x02,0x7F,ERROR,CHECKSUM (ERROR=1 checksum, 2 otherwise).

const int LED_PIN = 7;
const int PWM_PIN = 3;

uint8_t ledState = 0;
uint8_t pwmState = 0;

enum { WAIT_START, READ_LEN, READ_DATA };
int state = WAIT_START;
uint8_t buf[20];   // CMD + up to 16 payload + checksum
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

void sendNak(uint8_t err) {
  sendFrame(0x7F, &err, 1);
}

void processFrame() {
  // buf[0..len-1] = CMD + payload; buf[len] = checksum.
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
        if (c < 1 || c > 16) { sendNak(2); state = WAIT_START; }
        else { len = c; idx = 0; state = READ_DATA; }
        break;
      case READ_DATA:
        buf[idx++] = c;
        if (idx == len + 1) { processFrame(); state = WAIT_START; }
        break;
    }
  }
}
