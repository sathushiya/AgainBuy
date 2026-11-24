import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { api, type UploadFile } from "./api";

const MAX_SIDE = 1600;

/** Opens the photo library. Resolves to the chosen assets, or [] if cancelled. */
export async function pickPhotos(limit: number) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 1,
  });
  return result.canceled ? [] : result.assets.slice(0, limit);
}

/**
 * Shrinks a photo to at most 1600px on its longer side and re-encodes it as
 * JPEG (which also converts iPhone HEIC photos), then uploads it. Phone
 * photos drop from several MB to a few hundred KB, which keeps uploads quick
 * on mobile data. Resolves to the hosted image URL.
 */
export async function uploadPhoto(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  return (await api.uploadImage(await photoFile(asset))).url;
}

/** A picked photo, shrunk and re-encoded as JPEG, ready to send in a form (also used for payment receipts). */
export async function photoFile(asset: ImagePicker.ImagePickerAsset, prefix = "photo"): Promise<UploadFile> {
  const prepared = await shrink(asset);
  const name = `${prefix}-${Date.now()}.jpg`;
  return Platform.OS === "web"
    ? { webFile: await (await fetch(prepared)).blob(), name }
    : { uri: prepared, name, type: "image/jpeg" };
}

async function shrink(asset: ImagePicker.ImagePickerAsset) {
  try {
    const longer = Math.max(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri);
    if (longer > MAX_SIDE) context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    const image = await context.renderAsync();
    return (await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })).uri;
  } catch {
    // Fall back to the original; the server still resizes on upload.
    return asset.uri;
  }
}
