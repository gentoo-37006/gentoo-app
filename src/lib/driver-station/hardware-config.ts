import { XMLBuilder, XMLParser } from 'fast-xml-parser';

type OrderedXmlNode = Record<string, unknown> & {
  ':@'?: Record<string, string>;
};

export type HardwareName = {
  id: string;
  tag: string;
  name: string;
  port?: string;
  serialNumber?: string;
  depth: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  attributeNamePrefix: '',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  preserveOrder: true,
  attributeNamePrefix: '',
  format: true,
  suppressEmptyNode: true,
});

function parse(xml: string): OrderedXmlNode[] {
  const parsed = parser.parse(xml) as OrderedXmlNode[];
  if (!Array.isArray(parsed)) throw new Error('Invalid robot configuration XML');
  return parsed;
}

function visit(
  nodes: OrderedXmlNode[],
  visitor: (node: OrderedXmlNode, tag: string, id: string, depth: number) => void,
  path = 'root',
  depth = 0
) {
  nodes.forEach((node, nodeIndex) => {
    Object.entries(node).forEach(([tag, value]) => {
      if (tag === ':@' || tag === '#text' || tag.startsWith('?')) return;
      const id = `${path}.${nodeIndex}.${tag}`;
      visitor(node, tag, id, depth);
      if (Array.isArray(value)) {
        visit(value as OrderedXmlNode[], visitor, id, depth + 1);
      }
    });
  });
}

export function listHardwareNames(xml: string): HardwareName[] {
  if (!xml.trim()) return [];
  const names: HardwareName[] = [];
  visit(parse(xml), (node, tag, id, depth) => {
    const attributes = node[':@'];
    if (!attributes?.name) return;
    names.push({
      id,
      tag,
      name: attributes.name,
      port: attributes.port,
      serialNumber: attributes.serialNumber,
      depth,
    });
  });
  return names;
}

export function renameHardware(xml: string, id: string, name: string): string {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Hardware names cannot be empty');
  const parsed = parse(xml);
  let found = false;
  visit(parsed, (node, _tag, nodeId) => {
    if (nodeId !== id || !node[':@']?.name) return;
    node[':@']!.name = trimmedName;
    found = true;
  });
  if (!found) throw new Error('Hardware item was not found');
  return builder.build(parsed);
}

export function validateHardwareNames(xml: string): string | null {
  const names = listHardwareNames(xml);
  const normalized = new Map<string, string>();
  for (const item of names) {
    const key = item.name.trim().toLocaleLowerCase();
    if (!key) return 'Hardware names cannot be empty.';
    const existing = normalized.get(key);
    if (existing) return `"${item.name}" is used by more than one hardware device.`;
    normalized.set(key, item.id);
  }
  return null;
}
