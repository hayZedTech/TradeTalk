import { supabase } from '../lib/supabase';

// Cloudinary config - REPLACE WITH YOUR VALUES
const CLOUDINARY_CLOUD_NAME = 'dku2tdgxd';
const CLOUDINARY_UPLOAD_PRESET = 'tradetalk';

export const productService = {
  async getProducts(): Promise<any[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const productsWithOwners = await Promise.all(
      (data || []).map(async (product) => {
        const { data: owner } = await supabase
          .from('users')
          .select('*')
          .eq('id', product.user_id)
          .single();
        return { ...product, owner };
      })
    );

    return productsWithOwners;
  },

  async getProductById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;

    const { data: owner } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user_id)
      .single();

    return { ...data, owner };
  },

  async addProduct(product: {
    title: string;
    price: number;
    description: string;
    category: string;
    condition: string;
    imageUri: string;
  }): Promise<any> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      console.log('Uploading to Cloudinary...');

      // Create FormData for Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri: product.imageUri,
        type: 'image/jpeg',
        name: 'image.jpg',
      } as any);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      // Upload to Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      console.log('Cloudinary response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cloudinary error:', errorText);
        throw new Error('Failed to upload image to Cloudinary');
      }

      const cloudinaryData = await response.json();
      console.log('Cloudinary success:', cloudinaryData.secure_url);

      if (!cloudinaryData.secure_url) {
        throw new Error('No URL returned from Cloudinary');
      }

      // Insert product with Cloudinary URL and Price
      const { data, error } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          title: product.title,
          price: product.price,
          description: product.description,
          category: product.category,
          condition: product.condition,
          image_url: cloudinaryData.secure_url,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Product created successfully!');
      return data;
    } catch (error: any) {
      console.error('Error adding product:', error);
      throw new Error(error.message || 'Failed to add product');
    }
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  getImageUrl(path: string): string {
    // If it's already a full URL, return it
    if (path.startsWith('http')) return path;
    // Otherwise, use Supabase
    const { data } = supabase.storage
      .from('product-images')
      .getPublicUrl(path);
    return data.publicUrl;
  },
};