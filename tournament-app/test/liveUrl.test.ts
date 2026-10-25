import { describe, expect, test } from "bun:test";
import { liveUrl, lanAddress } from "../web/src/lib/liveUrl";
import { qrPath } from "../web/src/lib/qr";

const page = (hostname: string, port = "") => ({ hostname, port, origin: `http://${hostname}${port ? `:${port}` : ""}` });
const v4 = (address: string, internal = false) => ({ family: "IPv4", internal, address });

describe("liveUrl", () => {
  test("the Pi's IP from the network file, port 80 left out", () => {
    expect(liveUrl({ ip: "10.42.0.1" }, {}, page("localhost"))).toBe("http://10.42.0.1/live");
  });

  test("keeps the TV's port (dev, laptop launcher)", () => {
    expect(liveUrl({ ip: "10.42.0.1" }, {}, page("localhost", "5173"))).toBe("http://10.42.0.1:5173/live");
  });

  test("a TV opened on an IP already has the right address", () => {
    expect(liveUrl(null, { eth: [v4("192.168.1.9")] }, page("10.0.1.15", "3000"))).toBe("http://10.0.1.15:3000/live");
  });

  test("otherwise the machine's LAN address, not loopback", () => {
    expect(liveUrl(null, { eth: [v4("192.168.1.9")] }, page("127.0.0.1", "5173"))).toBe("http://192.168.1.9:5173/live");
  });

  test("falls back to the TV's own address", () => {
    expect(liveUrl(null, {}, page("beyfest.local"))).toBe("http://beyfest.local/live");
  });
});

describe("lanAddress", () => {
  test("skips virtual adapters and internal addresses, prefers 192.168", () => {
    const ifaces = {
      "vEthernet (WSL)": [v4("172.20.0.1")],
      Loopback: [v4("127.0.0.1", true)],
      "Wi-Fi": [v4("10.0.1.15"), { family: "IPv6", internal: false, address: "fe80::1" }],
      Ethernet: [v4("192.168.0.20")],
    };
    expect(lanAddress(ifaces)).toBe("192.168.0.20");
  });

  test("accepts the family as a number, skips link-local", () => {
    expect(lanAddress({ eth: [{ family: 4, internal: false, address: "169.254.3.3" }, { family: 4, internal: false, address: "10.1.1.1" }] })).toBe("10.1.1.1");
  });

  test("empty when there's no network", () => {
    expect(lanAddress({})).toBe("");
  });
});

describe("qrPath", () => {
  const qr = qrPath("http://192.168.1.50/live");

  test("a real QR size, one square per dark module", () => {
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect((qr.size - 17) % 4).toBe(0); // QR sizes are 17 + 4 × version
    expect(qr.path.split("M").length - 1).toBeGreaterThan(qr.size * 4);
  });

  test("the same text gives the same code", () => {
    expect(qrPath("http://192.168.1.50/live")).toEqual(qr);
  });
});
