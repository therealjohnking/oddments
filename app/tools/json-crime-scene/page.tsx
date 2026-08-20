import { JsonCrimeSceneApp } from '@/components/json-crime-scene/JsonCrimeSceneApp';
import { pageMetadata } from '@/lib/site/meta';

export const metadata = pageMetadata({
  name: 'JSON Crime Scene',
  description:
    'Inspect, understand, and diagnose one JSON document: a structural profile, an explorable tree, exact JSON Pointers, and findings — duplicate keys, inconsistent object shapes, mixed types, and numbers that lose precision. Runs entirely in your browser.',
  path: '/tools/json-crime-scene',
});

export default function JsonCrimeScenePage() {
  return <JsonCrimeSceneApp />;
}
