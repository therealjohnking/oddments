import type { Metadata } from 'next';
import { JsonCrimeSceneApp } from '@/components/json-crime-scene/JsonCrimeSceneApp';

export const metadata: Metadata = {
  title: 'JSON Crime Scene',
  description:
    'Inspect, understand, and diagnose one JSON document: a structural profile, an explorable tree, exact JSON Pointers, and findings — duplicate keys, inconsistent object shapes, mixed types, and numbers that lose precision. Runs entirely in your browser.',
};

export default function JsonCrimeScenePage() {
  return <JsonCrimeSceneApp />;
}
