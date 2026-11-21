import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, FilterChip, PrimaryButton, ScreenContainer, SecondaryButton } from "../../components/core";
import { useApp } from "../../context/AppContext";
import { categories, products } from "../../data/mockData";
import { colors, radius, spacing, typography } from "../../theme";

const schema = z.object({
  title: z.string().min(5, "Add a clear product title."),
  price: z.string().refine((value) => Number(value) > 0, "Enter a valid selling price."),
  originalPrice: z.string().optional(),
  brand: z.string().min(2, "Add the product brand."),
  model: z.string().min(1, "Add the model."),
  usage: z.string().min(2, "Add how long it was used."),
  year: z.string().regex(/^\d{4}$/, "Enter a four-digit year."),
  description: z.string().min(20, "Add at least 20 characters."),
  defects: z.string().min(2, "Describe defects or write “None”."),
  location: z.string().min(2, "Add a pickup location."),
});

export function SellScreen({ navigation }: { navigation: any }) {
  const { publishListing } = useApp();
  const [step, setStep] = React.useState<"form" | "preview" | "success">("form");
  const [category, setCategory] = React.useState("Electronics");
  const [condition, setCondition] = React.useState<"Like new" | "Excellent" | "Good" | "Fair">("Good");
  const { control, handleSubmit, getValues, formState: { errors, isValid } } = useForm({ resolver: zodResolver(schema), mode: "onChange", defaultValues: { title: "", price: "", originalPrice: "", brand: "", model: "", usage: "", year: "2023", description: "", defects: "None", location: "Colombo" } });
  const publish = () => {
    const values = getValues();
    publishListing({ ...products[4]!, id: `mine_${Date.now()}`, title: values.title, category, price: Number(values.price), originalPrice: Number(values.originalPrice) || undefined, condition, usage: values.usage, purchaseYear: Number(values.year), location: values.location, brand: values.brand, model: values.model, description: values.description, defects: values.defects, seller: "Maya Perera", listedAt: "Just now", status: "Active" });
    setStep("success");
  };
  if (step === "success") return <ScreenContainer contentStyle={styles.successScreen}><View style={styles.successIcon}><AppIcon name="leaf" size={42} color={colors.white}/></View><Text style={styles.successTitle}>Your item has a new chance.</Text><Text style={styles.successText}>The listing was published locally in demo mode. No production marketplace record was created.</Text><PrimaryButton title="View my listings" onPress={() => navigation.navigate("MyListings")} style={styles.full}/><SecondaryButton title="Sell another item" onPress={() => setStep("form")} style={styles.full}/></ScreenContainer>;
  if (step === "preview") {
    const values = getValues();
    return <ScreenContainer><Text style={styles.eyebrow}>LISTING PREVIEW</Text><Text style={styles.title}>Check every detail.</Text><Image source={{ uri: products[4]!.image }} style={styles.previewImage}/><Text style={styles.previewTitle}>{values.title}</Text><Text style={styles.previewPrice}>LKR {Number(values.price).toLocaleString()}</Text><Text style={styles.previewMeta}>{condition} · {values.usage} · {values.location}</Text><View style={styles.previewSection}><Text style={styles.label}>Description</Text><Text style={styles.previewBody}>{values.description}</Text></View><View style={styles.previewSection}><Text style={styles.label}>Known defects</Text><Text style={styles.previewBody}>{values.defects}</Text></View><View style={styles.actions}><SecondaryButton title="Edit" onPress={() => setStep("form")} style={styles.flex}/><PrimaryButton title="Publish listing" onPress={publish} style={styles.flex}/></View><Text style={styles.note}>Publication is simulated and remains only in local app state.</Text></ScreenContainer>;
  }
  return <ScreenContainer keyboardAware><Text style={styles.eyebrow}>SELL ON AGAINBUY</Text><Text style={styles.title}>Give your item another life.</Text><Text style={styles.subtitle}>Honest details help buyers make confident decisions.</Text><View style={styles.upload}><View style={styles.uploadIcon}><AppIcon name="camera-outline" size={30} color={colors.terracotta}/></View><Text style={styles.uploadTitle}>Add product photos</Text><Text style={styles.uploadText}>Show the front, back, labels, accessories, and any defects.</Text><SecondaryButton title="Choose photos" onPress={() => {}}/></View><Text style={styles.label}>Category</Text><View style={styles.chips}>{categories.slice(1, 6).map((item) => <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)}/>)}</View><View style={styles.form}><Form control={control} name="title" label="Product title" error={errors.title?.message}/><View style={styles.row}><View style={styles.flex}><Form control={control} name="brand" label="Brand" error={errors.brand?.message}/></View><View style={styles.flex}><Form control={control} name="model" label="Model" error={errors.model?.message}/></View></View><View style={styles.row}><View style={styles.flex}><Form control={control} name="price" label="Selling price (LKR)" keyboardType="numeric" error={errors.price?.message}/></View><View style={styles.flex}><Form control={control} name="originalPrice" label="Original price" keyboardType="numeric" error={errors.originalPrice?.message}/></View></View><Text style={styles.label}>Condition</Text><View style={styles.chips}>{(["Like new","Excellent","Good","Fair"] as const).map((item) => <FilterChip key={item} label={item} selected={condition === item} onPress={() => setCondition(item)}/>)}</View><View style={styles.row}><View style={styles.flex}><Form control={control} name="usage" label="Usage duration" error={errors.usage?.message}/></View><View style={styles.flex}><Form control={control} name="year" label="Purchase year" keyboardType="numeric" error={errors.year?.message}/></View></View><Form control={control} name="description" label="Description" multiline error={errors.description?.message}/><Form control={control} name="defects" label="Known defects or missing accessories" multiline error={errors.defects?.message}/><Form control={control} name="location" label="Pickup location" error={errors.location?.message}/><Pressable style={styles.proof}><AppIcon name="receipt-outline" size={22} color={colors.terracotta}/><View style={styles.flex}><Text style={styles.proofTitle}>Add proof of purchase</Text><Text style={styles.uploadText}>Optional · Hide personal payment details</Text></View><AppIcon name="add" size={20} color={colors.terracotta}/></Pressable><PrimaryButton title="Preview listing" disabled={!isValid} onPress={handleSubmit(() => setStep("preview"))}/></View></ScreenContainer>;
}

function Form({ control, name, label, error, ...props }: any) {
  return <Controller control={control} name={name} render={({ field }) => <AppTextInput label={label} value={field.value} onChangeText={field.onChange} error={error} {...props}/>}/>;
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.label, color: colors.green, letterSpacing: 1 },
  title: { ...typography.display, color: colors.charcoal, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  upload: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.terracotta, borderRadius: radius.lg, backgroundColor: colors.terracottaSoft, alignItems: "center", padding: spacing.lg, marginTop: spacing.lg, gap: spacing.xs },
  uploadIcon: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  uploadTitle: { ...typography.medium, color: colors.charcoal },
  uploadText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  label: { ...typography.caption, color: colors.charcoal, fontWeight: "700", marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  form: { gap: spacing.md, marginTop: spacing.lg },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  proof: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: spacing.sm },
  proofTitle: { ...typography.medium, color: colors.charcoal },
  previewImage: { width: "100%", height: 310, borderRadius: radius.lg, marginTop: spacing.lg },
  previewTitle: { ...typography.heading, color: colors.charcoal, marginTop: spacing.md },
  previewPrice: { ...typography.title, color: colors.terracotta, marginTop: spacing.xs },
  previewMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 3 },
  previewSection: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  previewBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  note: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  successScreen: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  successIcon: { width: 80, height: 80, borderRadius: 30, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  successTitle: { ...typography.display, color: colors.charcoal, textAlign: "center", marginTop: spacing.lg },
  successText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.md },
  full: { width: "100%", marginTop: spacing.sm },
});
