import type { FileSubmission, FormRenderNode, FormSubmissionValue } from '@enagar/forms';
import * as DocumentPicker from 'expo-document-picker';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { MobilePendingFile } from '../api/documentsApi';

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

type Props = {
  nodes: FormRenderNode[];
  values: Record<string, FormSubmissionValue | undefined>;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  onFilePick?: (fieldId: string, file: MobilePendingFile | null) => void;
};

/** Maps `@enagar/forms` render-plan nodes to RN inputs (`platform: 'native'`). */
export function DynamicFormFields({ nodes, values, onChange, onFilePick }: Props) {
  return (
    <View style={styles.stack}>
      {nodes
        .filter((node) => node.visible)
        .map((node) => (
          <FormNode
            key={node.id}
            node={node}
            onChange={onChange}
            onFilePick={onFilePick}
            value={values[node.id]}
          />
        ))}
    </View>
  );
}

function FormNode({
  node,
  value,
  onChange,
  onFilePick,
}: {
  node: FormRenderNode;
  value: FormSubmissionValue | undefined;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  onFilePick?: (fieldId: string, file: MobilePendingFile | null) => void;
}) {
  if (node.widget === 'section') {
    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{node.label}</Text>
      </View>
    );
  }

  const suffix = node.required ? ' *' : '';

  if (node.widget === 'textarea') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        {node.help_text ? <Text style={styles.help}>{node.help_text}</Text> : null}
        <TextInput
          editable
          multiline
          placeholder={node.help_text ?? node.label}
          style={[styles.input, styles.textarea]}
          onChangeText={(text) => onChange(node.id, text)}
          value={typeof value === 'string' ? value : ''}
        />
      </View>
    );
  }

  if (node.widget === 'number-input') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <TextInput
          keyboardType="numeric"
          style={styles.input}
          onChangeText={(text) => {
            if (text === '') {
              onChange(node.id, undefined);
              return;
            }
            const n = Number(text);
            onChange(node.id, Number.isFinite(n) ? n : undefined);
          }}
          value={typeof value === 'number' ? String(value) : ''}
        />
      </View>
    );
  }

  if (node.widget === 'date-input') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <TextInput
          placeholder="YYYY-MM-DD"
          style={styles.input}
          onChangeText={(text) => onChange(node.id, text)}
          value={typeof value === 'string' ? value : ''}
        />
      </View>
    );
  }

  if (node.widget === 'choice-list' || node.widget === 'select') {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <View style={styles.choiceCol}>
          {node.options?.map((opt) => {
            const selected = String(value ?? '') === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                onPress={() => onChange(node.id, opt.value)}
                style={[styles.choiceRow, selected && styles.choiceRowSelected]}
              >
                <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (node.widget === 'multi-choice-list') {
    const arr = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <View style={styles.choiceCol}>
          {node.options?.map((opt) => {
            const selected = arr.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="button"
                onPress={() => {
                  const next = selected ? arr.filter((v) => v !== opt.value) : [...arr, opt.value];
                  onChange(node.id, next.length ? next : undefined);
                }}
                style={[styles.choiceRow, selected && styles.choiceRowSelected]}
              >
                <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  if (node.widget === 'file-picker') {
    const maxMb = node.max_size_mb ?? 10;
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <Pressable
          style={styles.fileBtn}
          onPress={() => {
            void (async () => {
              const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: node.accept?.length
                  ? node.accept
                  : ['application/pdf', 'image/jpeg', 'image/png'],
              });
              if (result.canceled || !result.assets?.[0]) {
                onChange(node.id, undefined);
                onFilePick?.(node.id, null);
                return;
              }
              const asset = result.assets[0];
              const sizeMb = Math.max(0.01, (asset.size ?? 0) / (1024 * 1024));
              if (sizeMb > maxMb) {
                onChange(node.id, undefined);
                onFilePick?.(node.id, null);
                return;
              }
              const mime = asset.mimeType ?? 'application/octet-stream';
              const payload: FileSubmission = {
                name: asset.name,
                mime_type: mime,
                size_mb: sizeMb,
              };
              onChange(node.id, payload);
              onFilePick?.(node.id, {
                uri: asset.uri,
                name: asset.name,
                mime_type: mime,
                size_mb: sizeMb,
              });
            })();
          }}
        >
          <Text style={styles.fileBtnText}>Choose file</Text>
        </Pressable>
        {isFileSubmission(value) ? (
          <Text style={styles.mini}>
            Selected: {value.name} ({value.size_mb.toFixed(2)} MB)
          </Text>
        ) : (
          <Text style={styles.mini}>Max {maxMb} MB</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {node.label}
        <Text style={styles.req}>{suffix}</Text>
      </Text>
      <TextInput
        style={styles.input}
        onChangeText={(text) => onChange(node.id, text)}
        value={typeof value === 'string' ? value : ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  field: { marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155' },
  req: { color: '#B91C1C' },
  help: { fontSize: 12, color: '#64748B', marginTop: 4 },
  input: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  sectionCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(15,76,117,0.08)',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F4C75' },
  choiceCol: { marginTop: 8, gap: 6 },
  choiceRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  choiceRowSelected: {
    borderColor: '#0F4C75',
    backgroundColor: 'rgba(15,76,117,0.06)',
  },
  choiceLabel: { fontSize: 15, color: '#334155' },
  choiceLabelSelected: { fontWeight: '700', color: '#0F4C75' },
  mini: { marginTop: 6, fontSize: 11, color: '#94A3B8' },
  fileBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#0F4C75',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fileBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
