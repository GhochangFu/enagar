import type { FileSubmission, FormRenderNode, FormSubmissionValue } from '@enagar/forms';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

type Props = {
  nodes: FormRenderNode[];
  values: Record<string, FormSubmissionValue | undefined>;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
};

/** Maps `@enagar/forms` render-plan nodes to RN inputs (`platform: 'native'`). */
export function DynamicFormFields({ nodes, values, onChange }: Props) {
  return (
    <View style={styles.stack}>
      {nodes
        .filter((node) => node.visible)
        .map((node) => (
          <FormNode key={node.id} node={node} onChange={onChange} value={values[node.id]} />
        ))}
    </View>
  );
}

function FormNode({
  node,
  value,
  onChange,
}: {
  node: FormRenderNode;
  value: FormSubmissionValue | undefined;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
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
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {node.label}
          <Text style={styles.req}>{suffix}</Text>
        </Text>
        <TextInput
          placeholder="filename.pdf"
          style={styles.input}
          onChangeText={(text) => {
            const payload: FileSubmission = {
              name: text.trim() ? text.trim() : `${node.id}.pdf`,
              mime_type: 'application/pdf',
              size_mb: 1,
            };
            onChange(node.id, payload);
          }}
          value={isFileSubmission(value) ? value.name : ''}
        />
        <Text style={styles.mini}>Simulated file metadata (matches PWA dev flow).</Text>
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
});
