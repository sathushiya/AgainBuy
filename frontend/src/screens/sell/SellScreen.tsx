import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { AppIcon } from "../../components/AppIcon";
import { AppTextInput, BackButton, ErrorMessage, FilterChip, PrimaryButton, ScreenContainer, SecondaryButton } from "../../components/core";
import { ProductImage } from "../../components/marketplace";
import { fieldsFor, toSpecifications, validateCategoryFields, type FieldValues } from "../../config/listingFields";
import { useApiData } from "../../hooks/useApiData";
import { api, errorMessage } from "../../services/api";
import { pickPhotos, uploadPhoto } from "../../services/photos";
import { DeliveryOption } from "../../types";
import { deliveryLabel } from "../../utils/format";
import { colors, radius, spacing, typography } from "../../theme";
import { CategoryDetailsStep } from "./CategoryDetailsStep";

const schema = z.object({
  title: z.string().min(5, "Add a clear product title."),
  price: z.string().refine((value) => Number(value) > 0, "Enter a valid selling price."),
  originalPrice: z.string().optional(),
  // Brand and model are asked for, and validated, on the category step where the category has them.
  brand: z.string(),
  model: z.string(),
  usage: z.string().min(2, "Add how long it was used."),
  year: z.string().regex(/^\d{4}$/, "Enter a four-digit year."),
  description: z.string().min(20, "Add at least 20 characters."),
  defects: z.string().min(2, "Describe defects or write “None”."),
  location: z.string().min(2, "Add a pickup location."),
  reasonForSelling: z.string().max(300, "Keep the reason under 300 characters."),
});

const MAX_PHOTOS = 8;
// Chip wording for each saved delivery value (the API keeps "Delivery", "Meet-up", "Both").
const DELIVERY_OPTIONS: readonly { value: DeliveryOption; label: string }[] = [
  { value: "Delivery", label: "Delivery Available" },
  { value: "Meet-up", label: "Pickup Only" },
];

export function SellScreen({ navigation }: { navigation: any }) {
  const { data: categories = [] } = useApiData(() => api.categories());
  const { data: settings } = useApiData(() => api.accountSettings());
  const savedLocations = settings?.savedLocations ?? [];
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState<{ done: number; total: number } | null>(null);
  const [photoError, setPhotoError] = React.useState<string | null>(null);

  const addPhotos = async () => {
    if (uploading || photos.length >= MAX_PHOTOS) return;
    setPhotoError(null);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      for (const [index, asset] of picked.entries()) {
        setUploading({ done: index, total: picked.length });
        const url = await uploadPhoto(asset);
        setPhotos((current) => [...current, url]);
      }
    } catch (caught) {
      setPhotoError(errorMessage(caught));
    } finally {
      setUploading(null);
    }
  };
  // Listing details (common fields) → category details → review → success.
  const [step, setStep] = React.useState<"form" | "details" | "preview" | "success">("form");
  const [specifics, setSpecifics] = React.useState<FieldValues>({});
  const [detailsSubmitted, setDetailsSubmitted] = React.useState(false);
  const [category, setCategory] = React.useState("Electronics");
  const [condition, setCondition] = React.useState<"Like new" | "Excellent" | "Good" | "Fair">("Good");
  const [delivery, setDelivery] = React.useState<DeliveryOption>("Meet-up");
  const { control, handleSubmit, getValues, getFieldState, setValue, watch, formState: { errors, isValid } } = useForm({ resolver: zodResolver(schema), mode: "onChange", defaultValues: { title: "", price: "", originalPrice: "", brand: "", model: "", usage: "", year: "2023", description: "", defects: "None", location: "Colombo", reasonForSelling: "" } });
  // Start from the default saved location, unless the seller already typed one.
  const defaultLocation = savedLocations[0];
  React.useEffect(() => {
    if (defaultLocation && !getFieldState("location").isDirty) setValue("location", defaultLocation, { shouldValidate: true });
  }, [defaultLocation, getFieldState, setValue]);
  const pickupLocation = watch("location");

  // Category fields see brand and model from the first step, and edit them in place.
  const categoryValues: FieldValues = { ...specifics, brand: watch("brand"), model: watch("model") };
  const categoryErrors = validateCategoryFields(category, categoryValues);
  // Only send brand/model when the chosen category asks for them (they may linger from another category).
  const usesCommon = new Set(fieldsFor(category, categoryValues).map((field) => field.common).filter(Boolean));
  const changeCategoryField = (key: string, value: string) => {
    const common = fieldsFor(category, categoryValues).find((field) => field.key === key)?.common;
    if (common) setValue(common, value, { shouldValidate: true, shouldDirty: true });
    else setSpecifics((current) => ({ ...current, [key]: value }));
  };
  const continueToReview = () => {
    setDetailsSubmitted(true);
    if (Object.keys(categoryErrors).length === 0) setStep("preview");
  };

  const publish = async () => {
    const values = getValues();
    setPublishing(true);
    setPublishError(null);
    try {
      await api.createListing({ title: values.title, category, price: Number(values.price), originalPrice: Number(values.originalPrice) || undefined, condition, usage: values.usage, purchaseYear: Number(values.year), location: values.location, brand: usesCommon.has("brand") ? values.brand.trim() : undefined, model: usesCommon.has("model") ? values.model.trim() : undefined, description: values.description, defects: values.defects, reasonForSelling: values.reasonForSelling.trim() || undefined, delivery, specifications: toSpecifications(category, categoryValues), images: photos });
      setStep("success");
    } catch (caught) {
      setPublishError(errorMessage(caught));
    } finally {
      setPublishing(false);
    }
  };
  if (step === "success") return <ScreenContainer contentStyle={styles.successScreen}><View style={styles.successIcon}><AppIcon name="leaf" size={42} color={colors.white}/></View><Text style={styles.successTitle}>Your item has a new chance.</Text><Text style={styles.successText}>Your listing is live on AgainBuy. Buyers can now find it, save it, and message you.</Text><PrimaryButton title="View my listings" onPress={() => navigation.navigate("MyListings")} style={styles.full}/><SecondaryButton title="Sell another item" onPress={() => { setPhotos([]); setSpecifics({}); setDetailsSubmitted(false); setStep("form"); }} style={styles.full}/></ScreenContainer>;
  if (step === "details") return <CategoryDetailsStep category={category} values={categoryValues} errors={categoryErrors} showErrors={detailsSubmitted} onChange={changeCategoryField} onBack={() => setStep("form")} onNext={continueToReview}/>;
  if (step === "preview") {
    const values = getValues();
    const specifications = toSpecifications(category, categoryValues);
    const incomplete = Object.keys(categoryErrors).length > 0;
    return <ScreenContainer><BackButton label="Back to category details" onPress={() => setStep("details")}/><Text style={styles.eyebrow}>LISTING PREVIEW</Text><Text style={styles.title}>Check every detail.</Text><ProductImage uri={photos[0] ?? ""} style={styles.previewImage} label={photos.length ? "First listing photo" : "No photo yet"}/><Text style={styles.previewTitle}>{values.title}</Text><Text style={styles.previewPrice}>LKR {Number(values.price).toLocaleString()}</Text><Text style={styles.previewMeta}>{condition} · {values.usage} · {values.location} · {deliveryLabel(delivery)}</Text><View style={styles.previewSection}><Text style={styles.label}>{category} details</Text><SpecRow label="Category" value={category}/>{usesCommon.has("brand") && values.brand.trim() ? <SpecRow label="Brand" value={values.brand}/> : null}{usesCommon.has("model") && values.model.trim() ? <SpecRow label="Model" value={values.model}/> : null}{specifications.map((specification) => <SpecRow key={specification.key} label={specification.label} value={specification.value}/>)}<Pressable accessibilityRole="button" onPress={() => setStep("details")}><Text style={styles.editLink}>Edit {category.toLowerCase()} details</Text></Pressable></View><View style={styles.previewSection}><Text style={styles.label}>Description</Text><Text style={styles.previewBody}>{values.description}</Text></View><View style={styles.previewSection}><Text style={styles.label}>Known defects</Text><Text style={styles.previewBody}>{values.defects}</Text></View>{values.reasonForSelling.trim() && <View style={styles.previewSection}><Text style={styles.label}>Reason for selling</Text><Text style={styles.previewBody}>{values.reasonForSelling.trim()}</Text></View>}<View style={styles.actions}><SecondaryButton title="Edit" onPress={() => setStep("form")} style={styles.flex}/><PrimaryButton title="Publish listing" disabled={incomplete} loading={publishing} onPress={publish} style={styles.flex}/></View>{incomplete && <ErrorMessage message={`Complete the required ${category.toLowerCase()} details before publishing.`}/>}{publishError && <ErrorMessage message={publishError}/>}{photos.length === 0 && <Text style={styles.note}>No photos added. Listings with photos get far more interest.</Text>}</ScreenContainer>;
  }
  return <ScreenContainer keyboardAware><BackButton label="Go back" onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")}/><Text style={styles.eyebrow}>SELL ON AGAINBUY</Text><Text style={styles.title}>Give your item another life.</Text><Text style={styles.subtitle}>Honest details help buyers make confident decisions.</Text><View style={styles.upload}><View style={styles.uploadIcon}><AppIcon name="camera-outline" size={30} color={colors.terracotta}/></View><Text style={styles.uploadTitle}>Add product photos</Text><Text style={styles.uploadText}>Show the front, back, labels, accessories, and any defects. Up to {MAX_PHOTOS} photos.</Text>{photos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>{photos.map((url, index) => <View key={url}><Image source={{ uri: url }} style={styles.thumb} accessibilityLabel={`Photo ${index + 1}`}/><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} hitSlop={6} onPress={() => setPhotos((current) => current.filter((item) => item !== url))} style={styles.removeThumb}><AppIcon name="close" size={14} color={colors.white}/></Pressable></View>)}</ScrollView>}{uploading ? <Text style={styles.uploading}>Uploading {uploading.done + 1} of {uploading.total}…</Text> : photos.length < MAX_PHOTOS && <SecondaryButton title={photos.length ? `Add more photos (${photos.length}/${MAX_PHOTOS})` : "Choose photos"} onPress={addPhotos}/>}{photoError && <ErrorMessage message={photoError}/>}</View><Text style={styles.label}>Category</Text><View style={styles.chips}>{categories.map(({ name: item }) => <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)}/>)}</View><View style={styles.form}><Form control={control} name="title" label="Product title" error={errors.title?.message}/><View style={styles.row}><View style={styles.flex}><Form control={control} name="price" label="Selling price (LKR)" keyboardType="numeric" error={errors.price?.message}/></View><View style={styles.flex}><Form control={control} name="originalPrice" label="Original price" keyboardType="numeric" error={errors.originalPrice?.message}/></View></View><Text style={styles.label}>Condition</Text><View style={styles.chips}>{(["Like new","Excellent","Good","Fair"] as const).map((item) => <FilterChip key={item} label={item} selected={condition === item} onPress={() => setCondition(item)}/>)}</View><View style={styles.row}><View style={styles.flex}><Form control={control} name="usage" label="Usage duration" error={errors.usage?.message}/></View><View style={styles.flex}><Form control={control} name="year" label="Purchase year" keyboardType="numeric" error={errors.year?.message}/></View></View><Form control={control} name="description" label="Description" multiline error={errors.description?.message}/><Form control={control} name="defects" label="Known defects or missing accessories" multiline error={errors.defects?.message}/><Form control={control} name="reasonForSelling" label="Reason for selling (optional)" placeholder="e.g. Upgraded to a newer model" multiline error={errors.reasonForSelling?.message}/><Form control={control} name="location" label="Pickup location" error={errors.location?.message}/>{savedLocations.length > 0 && <View style={styles.chips}>{savedLocations.map((place) => <FilterChip key={place} label={place} selected={pickupLocation === place} onPress={() => setValue("location", place, { shouldValidate: true, shouldDirty: true })}/>)}</View>}<View><Text style={styles.label}>Delivery availability</Text><View style={styles.chips}>{DELIVERY_OPTIONS.map((option) => <FilterChip key={option.value} label={option.label} selected={delivery === option.value} onPress={() => setDelivery(option.value)}/>)}</View></View><Pressable style={styles.proof}><AppIcon name="receipt-outline" size={22} color={colors.terracotta}/><View style={styles.flex}><Text style={styles.proofTitle}>Add proof of purchase</Text><Text style={styles.uploadText}>Optional · Hide personal payment details</Text></View><AppIcon name="add" size={20} color={colors.terracotta}/></Pressable><PrimaryButton title="Next" disabled={!isValid} onPress={handleSubmit(() => { setDetailsSubmitted(false); setStep("details"); })}/></View></ScreenContainer>;
}

function Form({ control, name, label, error, ...props }: any) {
  return <Controller control={control} name={name} render={({ field }) => <AppTextInput label={label} value={field.value} onChangeText={field.onChange} error={error} {...props}/>}/>;
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.specRow}><Text style={styles.specLabel}>{label}</Text><Text style={styles.specValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.label, color: colors.green, letterSpacing: 1 },
  title: { ...typography.display, color: colors.charcoal, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  upload: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.terracotta, borderRadius: radius.lg, backgroundColor: colors.terracottaSoft, alignItems: "center", padding: spacing.lg, marginTop: spacing.lg, gap: spacing.xs },
  uploadIcon: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  uploadTitle: { ...typography.medium, color: colors.charcoal },
  uploadText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
  thumbs: { gap: spacing.xs, paddingVertical: spacing.xs },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.creamSecondary },
  removeThumb: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" },
  uploading: { ...typography.caption, color: colors.terracotta, fontWeight: "700" },
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
  specRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, paddingVertical: 6 },
  specLabel: { ...typography.body, color: colors.textSecondary, flex: 1 },
  specValue: { ...typography.medium, color: colors.charcoal, flex: 1, textAlign: "right" },
  editLink: { ...typography.caption, color: colors.terracotta, fontWeight: "700", marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  note: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
  successScreen: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  successIcon: { width: 80, height: 80, borderRadius: 30, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  successTitle: { ...typography.display, color: colors.charcoal, textAlign: "center", marginTop: spacing.lg },
  successText: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginVertical: spacing.md },
  full: { width: "100%", marginTop: spacing.sm },
});
