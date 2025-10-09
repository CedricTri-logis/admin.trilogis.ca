/* eslint-disable @next/next/no-img-element */

"use client"

import { useState, useEffect, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Camera } from "lucide-react"

interface Building {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface Apartment {
  id: string;
  apartment_name: string;
  unit_address: string;
  unit_number?: string;
  building_id: string;
}

interface ApartmentImage {
  id: string;
  apartment_id: string;
  building_id: string;
  image_path: string;
  file_name: string;
  caption: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  url?: string; // Added for storing the generated URL
}

interface BuildingImage {
  id: string;
  building_id: string;
  image_path: string;
  file_name: string;
  caption: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  url?: string; // Added for storing the generated URL
}

export default function PicturesPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedApartment, setSelectedApartment] = useState<Apartment | null>(null);
  const [apartmentImages, setApartmentImages] = useState<ApartmentImage[]>([]);
  const [buildingImages, setBuildingImages] = useState<BuildingImage[]>([]);
  const [showBuildingImages, setShowBuildingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load buildings on mount
  useEffect(() => {
    loadBuildings();
  }, []);

  // Load apartments and building images when building is selected
  useEffect(() => {
    if (selectedBuilding) {
      loadApartments(selectedBuilding.id);
      loadBuildingImages(selectedBuilding.id);
    } else {
      setApartments([]);
      setSelectedApartment(null);
      setBuildingImages([]);
      setShowBuildingImages(false);
    }
  }, [selectedBuilding]);

  // Load images when apartment is selected
  useEffect(() => {
    if (selectedApartment) {
      loadApartmentImages(selectedApartment.id);
    } else {
      setApartmentImages([]);
    }
  }, [selectedApartment]);

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  };

  const loadApartments = async (buildingId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('building_id', buildingId)
        .order('apartment_name');

      if (error) throw error;
      setApartments(data || []);
    } catch (error) {
      console.error('Error loading apartments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadApartmentImages = async (apartmentId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('apartment_images')
        .select('*')
        .eq('apartment_id', apartmentId)
        .eq('is_active', true)
        .order('display_order')
        .limit(50); // Limit to 50 images for performance

      if (error) throw error;

      // Generate public URLs with image transformations for thumbnails
      const imagesWithUrls = (data || []).map(image => {
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(image.image_path, {
            transform: {
              width: 400,
              height: 300,
              quality: 75,
            }
          });

        return {
          ...image,
          url: urlData.publicUrl
        };
      });

      setApartmentImages(imagesWithUrls);
    } catch (error) {
      console.error('Error loading apartment images:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBuildingImages = async (buildingId: string) => {
    try {
      const { data, error } = await supabase
        .from('building_images')
        .select('*')
        .eq('building_id', buildingId)
        .eq('is_active', true)
        .order('display_order')
        .limit(50); // Limit to 50 images for performance

      if (error) throw error;

      // Generate public URLs with image transformations for thumbnails
      const imagesWithUrls = (data || []).map(image => {
        const { data: urlData } = supabase.storage
          .from('property-images')
          .getPublicUrl(image.image_path, {
            transform: {
              width: 400,
              height: 300,
              quality: 75,
            }
          });

        return {
          ...image,
          url: urlData.publicUrl
        };
      });

      setBuildingImages(imagesWithUrls);
    } catch (error) {
      console.error('Error loading building images:', error);
    }
  };

  // Upload handler for apartment images
  const handleApartmentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedApartment || !selectedBuilding) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      // Create storage path: building_name/apartment_name/timestamp.ext
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const buildingFolder = selectedBuilding.name.replace(/\s+/g, '_');
      const apartmentFolder = selectedApartment.apartment_name.replace(/\s+/g, '_');
      const storagePath = `${buildingFolder}/${apartmentFolder}/${timestamp}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Get the highest display order
      const maxOrder = apartmentImages.reduce((max, img) =>
        Math.max(max, img.display_order), 0);

      // Insert record into database
      const { data, error: dbError } = await supabase
        .from('apartment_images')
        .insert({
          apartment_id: selectedApartment.id,
          building_id: selectedBuilding.id,
          image_path: storagePath,
          file_name: file.name,
          display_order: maxOrder + 1,
          is_primary: apartmentImages.length === 0, // First image is primary
          is_active: true
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Add URL to the image
      const { data: urlData } = supabase.storage
        .from('property-images')
        .getPublicUrl(storagePath, {
          transform: {
            width: 400,
            height: 300,
            quality: 75,
          }
        });

      setApartmentImages([...apartmentImages, { ...data, url: urlData.publicUrl }]);
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  // Delete handler for apartment images
  const handleDeleteApartmentImage = async (imageId: string, imagePath: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('property-images')
        .remove([imagePath]);

      if (storageError) console.warn('Storage delete warning:', storageError);

      // Mark as inactive in database (soft delete)
      const { error: dbError } = await supabase
        .from('apartment_images')
        .update({ is_active: false })
        .eq('id', imageId);

      if (dbError) throw dbError;

      setApartmentImages(apartmentImages.filter(img => img.id !== imageId));
      alert('Image deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Upload handler for building images
  const handleBuildingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !selectedBuilding) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      // Create storage path: building_name/_general/timestamp.ext
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const buildingFolder = selectedBuilding.name.replace(/\s+/g, '_');
      const storagePath = `${buildingFolder}/_general/${timestamp}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Get the highest display order
      const maxOrder = buildingImages.reduce((max, img) =>
        Math.max(max, img.display_order), 0);

      // Insert record into database
      const { data, error: dbError } = await supabase
        .from('building_images')
        .insert({
          building_id: selectedBuilding.id,
          image_path: storagePath,
          file_name: file.name,
          display_order: maxOrder + 1,
          is_primary: buildingImages.length === 0, // First image is primary
          is_active: true
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Add URL to the image
      const { data: urlData } = supabase.storage
        .from('property-images')
        .getPublicUrl(storagePath, {
          transform: {
            width: 400,
            height: 300,
            quality: 75,
          }
        });

      setBuildingImages([...buildingImages, { ...data, url: urlData.publicUrl }]);
      alert('Building image uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  // Delete handler for building images
  const handleDeleteBuildingImage = async (imageId: string, imagePath: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('property-images')
        .remove([imagePath]);

      if (storageError) console.warn('Storage delete warning:', storageError);

      // Mark as inactive in database (soft delete)
      const { error: dbError } = await supabase
        .from('building_images')
        .update({ is_active: false })
        .eq('id', imageId);

      if (dbError) throw dbError;

      setBuildingImages(buildingImages.filter(img => img.id !== imageId));
      alert('Image deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Failed to delete image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Photo Management
        </CardTitle>
        <CardDescription>
          Manage property images by building and apartment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Building Selector */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Building
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedBuilding?.id || ''}
            onChange={(e) => {
              const building = buildings.find(b => b.id === e.target.value);
              setSelectedBuilding(building || null);
              setSelectedApartment(null);
              setShowBuildingImages(false);
            }}
          >
            <option value="">-- Select a Building --</option>
            {buildings.map(building => (
              <option key={building.id} value={building.id}>
                {building.name} ({building.address}, {building.city})
              </option>
            ))}
          </select>
        </div>

        {/* Building Images Section */}
        {selectedBuilding && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <button
              onClick={() => {
                setShowBuildingImages(!showBuildingImages);
                setSelectedApartment(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                showBuildingImages
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              <span className="text-xl">🏢</span>
              <span className="font-medium">Building Images</span>
              <span className="text-sm">({buildingImages.length})</span>
            </button>

            {showBuildingImages && (
              <div className="mt-4">
                <div className="mb-4">
                  <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition inline-block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBuildingImageUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    {uploading ? 'Uploading...' : '+ Upload Building Image'}
                  </label>
                </div>
                {buildingImages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {buildingImages.map((image) => (
                      <div key={image.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="aspect-video bg-gray-100">
                          {image.url ? (
                            <img
                              src={image.url}
                              alt={image.caption || image.file_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-sm">Failed to load image</div>`;
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-gray-400 text-sm">No URL available</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="text-xs text-gray-600 mb-2 truncate">
                            {image.file_name}
                          </div>
                          {image.caption && (
                            <div className="text-sm text-gray-700 mb-2">{image.caption}</div>
                          )}
                          <div className="flex items-center justify-between">
                            {image.is_primary && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                Primary
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteBuildingImage(image.id, image.image_path)}
                              className="ml-auto px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No building images found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Apartments Grid */}
        {selectedBuilding && !showBuildingImages && (
          <div>
            <h2 className="text-lg font-semibold mb-3">
              Apartments in {selectedBuilding.name}
            </h2>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : apartments.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {apartments.map(apartment => (
                  <button
                    key={apartment.id}
                    onClick={() => setSelectedApartment(apartment)}
                    className={`p-3 border rounded-lg text-left hover:bg-gray-50 transition ${
                      selectedApartment?.id === apartment.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="font-medium">{apartment.apartment_name}</div>
                    <div className="text-sm text-gray-500">{apartment.unit_address}</div>
                    {apartment.unit_number && (
                      <div className="text-xs text-gray-400">Unit #{apartment.unit_number}</div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No apartments found in this building.
              </div>
            )}
          </div>
        )}

        {/* Apartment Images Gallery */}
        {selectedApartment && (
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Images for {selectedApartment.apartment_name}
              </h2>
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleApartmentImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
                {uploading ? 'Uploading...' : '+ Upload Image'}
              </label>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : apartmentImages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No images found for this apartment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apartmentImages.map((image) => (
                  <div key={image.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="aspect-video bg-gray-100">
                      {image.url ? (
                        <img
                          src={image.url}
                          alt={image.caption || image.file_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-sm">Failed to load image</div>`;
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-gray-400 text-sm">No URL available</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {image.is_primary && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                              Primary
                            </span>
                          )}
                          <span className="text-xs text-gray-500">
                            Order: {image.display_order}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-2 truncate">
                        {image.file_name}
                      </div>
                      {image.caption && (
                        <div className="text-sm text-gray-700 mb-2">{image.caption}</div>
                      )}
                      <button
                        onClick={() => handleDeleteApartmentImage(image.id, image.image_path)}
                        className="w-full px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
