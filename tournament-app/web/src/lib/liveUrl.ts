// The address the TV's QR code sends phones to: the phone page, /live, on an
// address a phone on the same network can reach. Kept free of server imports
// so the tests can load it; the TV's load function passes in what it knows.
//
// An IP rather than beyfest.local: .local names don't work on some networks
// and older Android phones.

type Iface = { family: string | number; internal: boolean; address: string };

// Virtual adapters that Windows (WSL, Hyper-V) and VM software add. Their
// addresses aren't on the venue network, so a phone can't reach them.
const VIRTUAL = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|docker|Loopback/i;

const isIPv4 = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

// Home and venue networks are nearly always 192.168.*, then 10.*, then 172.*.
function rank(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  if (ip.startsWith("172.")) return 2;
  return 3;
}

// The machine's own LAN address, or "" if it has none.
export function lanAddress(interfaces: Record<string, Iface[] | undefined>): string {
  const found: string[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (VIRTUAL.test(name)) continue;
    for (const i of list ?? []) {
      // Node reports the family as "IPv4" or 4, depending on the version.
      const v4 = i.family === "IPv4" || i.family === 4;
      if (v4 && !i.internal && !i.address.startsWith("169.254.")) found.push(i.address);
    }
  }
  return found.sort((a, b) => rank(a) - rank(b))[0] ?? "";
}

// Picks, in order: the Pi's IP (from the network file), the address the TV
// itself was opened on if that's already an IP, the machine's LAN address,
// and failing all that the TV's own address. The port is always the TV's:
// 80 on the Pi (left out), 3000 for the laptop launcher, 5173 in dev.
export function liveUrl(
  network: { ip: string } | null,
  interfaces: Record<string, Iface[] | undefined>,
  page: { hostname: string; port: string; origin: string },
): string {
  const port = page.port && page.port !== "80" ? `:${page.port}` : "";
  const fromPage = isIPv4(page.hostname) && !page.hostname.startsWith("127.") ? page.hostname : "";
  const ip = network?.ip || fromPage || lanAddress(interfaces);
  return ip ? `http://${ip}${port}/live` : `${page.origin}/live`;
}
