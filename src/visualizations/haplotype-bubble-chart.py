import pandas as pd
import plotly.graph_objects as go
import numpy as np
from typing import Dict, List
import sys
from pathlib import Path

# Constants
SAMPLE_COLUMNS = ['ALGA_C_S', 'ALGA_C_W', 'ALGA_C_E', 'ALGA_F_L', 'ALGA_F_M', 'ALGA_F_AS']
CREDIBILITY_COLORS = {
    'HIGH': '#4CAF50',
    'MODERATE': '#FFC107',
    'LOW': '#F44336'
}
MAX_SPECIES_DISPLAY = 20

def load_and_clean_data(file_path: str) -> pd.DataFrame:
    """Load CSV and clean haplotype data."""
    print(f"Loading data from: {file_path}")
    df = pd.read_csv(file_path)

    # Get species name from first column
    df['species_name'] = df.iloc[:, 0]

    # Remove empty rows
    df = df[df[SAMPLE_COLUMNS].notna().any(axis=1)]

    # Calculate total haplotypes across all samples
    df['total_haplotypes'] = df[SAMPLE_COLUMNS].sum(axis=1)

    # Remove rows with no detections
    df = df[df['total_haplotypes'] > 0]

    # Handle missing values
    df['score'] = df['score'].fillna('MODERATE')
    df['NNS'] = df['NNS'].fillna('NA')
    df['is_invasive'] = (df['NNS'] != 'NA') & (df['NNS'].notna())
    df['is_threatened'] = (df['RedList_Status'] != 'Not Evaluated') & (df['RedList_Status'].notna())

    print(f"[OK] Loaded {len(df)} species with detections")
    print(f"  - Invasive species: {df['is_invasive'].sum()}")
    print(f"  - Threatened species: {df['is_threatened'].sum()}")

    return df

def select_top_species(df: pd.DataFrame, max_species: int = 20) -> pd.DataFrame:
    """Select top species by haplotype diversity, always including invasive/threatened."""
    print(f"\nSelecting top {max_species} species...")

    # Always include invasive species
    invasive = df[df['is_invasive']].copy()
    print(f"  - Invasive species to include: {len(invasive)}")

    # Always include threatened species
    threatened = df[df['is_threatened']].copy()
    print(f"  - Threatened species to include: {len(threatened)}")

    # Get top N by total haplotypes
    top_diverse = df.nlargest(max_species, 'total_haplotypes')
    print(f"  - Most diverse species: {len(top_diverse)}")

    # Combine and remove duplicates
    selected = pd.concat([invasive, threatened, top_diverse]).drop_duplicates(subset=['species_name'])

    # Sort by total diversity (descending)
    selected = selected.sort_values('total_haplotypes', ascending=False)

    # Limit to max_species (but keep all invasive/threatened)
    mandatory = selected[selected['is_invasive'] | selected['is_threatened']]
    optional = selected[~(selected['is_invasive'] | selected['is_threatened'])]

    if len(mandatory) >= max_species:
        selected = mandatory.head(max_species)
    else:
        remaining_slots = max_species - len(mandatory)
        selected = pd.concat([mandatory, optional.head(remaining_slots)])

    print(f"[OK] Selected {len(selected)} species for visualization")
    return selected

def transform_to_long_format(df: pd.DataFrame) -> pd.DataFrame:
    """Convert wide format to long format for bubble plotting."""
    print("Transforming to long format...")
    records = []

    for _, row in df.iterrows():
        species_name = row['species_name']

        for sample in SAMPLE_COLUMNS:
            haplotype_count = int(row[sample])
            if haplotype_count > 0:  # Only include present species
                records.append({
                    'species': species_name,
                    'sample': sample,
                    'haplotype_count': haplotype_count,
                    'credibility': row['score'],
                    'phylum': row.get('phylum', 'Unknown'),
                    'is_invasive': row['is_invasive'],
                    'redlist': row.get('RedList_Status', 'Not Evaluated'),
                    'total_diversity': row['total_haplotypes'],
                    'nns_name': row.get('NNS', 'NA')
                })

    df_long = pd.DataFrame(records)
    print(f"[OK] Created {len(df_long)} data points")
    return df_long

def calculate_bubble_size(haplotype_count: int) -> float:
    """Map haplotype count to bubble size in pixels."""
    MIN_SIZE = 8
    SCALE_FACTOR = 5
    return MIN_SIZE + (haplotype_count * SCALE_FACTOR)

def create_bubble_chart(df_long: pd.DataFrame) -> go.Figure:
    """Generate Plotly bubble chart."""
    print("Creating bubble chart...")
    fig = go.Figure()

    # Get unique species for y-axis ordering (by total diversity)
    species_order = (df_long.groupby('species')['total_diversity']
                     .first()
                     .sort_values(ascending=False)
                     .index.tolist())

    # Create trace for each credibility level
    for credibility in ['HIGH', 'MODERATE', 'LOW']:
        df_cred = df_long[df_long['credibility'] == credibility]

        if df_cred.empty:
            print(f"  - No species with {credibility} credibility")
            continue

        print(f"  - {credibility}: {len(df_cred)} data points")

        # Calculate bubble sizes
        sizes = df_cred['haplotype_count'].apply(calculate_bubble_size).tolist()

        # Determine marker line colors (borders for invasive/threatened)
        line_colors = []
        line_widths = []
        for _, row in df_cred.iterrows():
            if row['is_invasive']:
                line_colors.append('#D32F2F')  # Dark red for invasive
                line_widths.append(3)
            elif row['redlist'] != 'Not Evaluated':
                line_colors.append('#FF6F00')  # Orange for threatened
                line_widths.append(2)
            else:
                line_colors.append(CREDIBILITY_COLORS[credibility])
                line_widths.append(1)

        # Create customdata for hover
        customdata = []
        for _, row in df_cred.iterrows():
            status_text = f"⚠️ IUCN: {row['redlist']}" if row['redlist'] != 'Not Evaluated' else ""
            invasive_text = f"🚨 Non-native species: {row['nns_name']}" if row['is_invasive'] else ""

            customdata.append([
                row['species'],
                row['haplotype_count'],
                row['credibility'],
                row['phylum'],
                status_text,
                invasive_text
            ])

        fig.add_trace(go.Scatter(
            name=credibility,
            x=df_cred['sample'],
            y=df_cred['species'],
            mode='markers',
            marker=dict(
                size=sizes,
                color=CREDIBILITY_COLORS[credibility],
                opacity=0.7,
                line=dict(
                    width=line_widths,
                    color=line_colors
                )
            ),
            customdata=customdata,
            hovertemplate=(
                '<b>%{customdata[0]}</b><br>'
                '<b>Sample:</b> %{x}<br>'
                '<b>Haplotypes:</b> %{customdata[1]}<br>'
                '<b>Credibility:</b> %{customdata[2]}<br>'
                '<b>Phylum:</b> %{customdata[3]}<br>'
                '%{customdata[4]}<br>'
                '%{customdata[5]}<br>'
                '<extra></extra>'
            )
        ))

    # Update layout
    fig.update_layout(
        title={
            'text': 'eDNA Haplotype Diversity and Detection Credibility',
            'font': {'size': 18, 'family': 'Arial, sans-serif'}
        },
        xaxis={
            'title': 'Sampling Location',
            'tickangle': -45,
            'tickfont': {'size': 11},
            'showgrid': True,
            'gridcolor': '#E0E0E0',
            'categoryorder': 'array',
            'categoryarray': SAMPLE_COLUMNS
        },
        yaxis={
            'title': 'Species (ranked by total haplotype diversity)',
            'tickfont': {'size': 10, 'style': 'italic'},
            'showgrid': True,
            'gridcolor': '#E0E0E0',
            'automargin': True,
            'categoryorder': 'array',
            'categoryarray': species_order[::-1]  # Reverse for top-to-bottom
        },
        width=1000,
        height=800,
        hovermode='closest',
        plot_bgcolor='#FAFAFA',
        paper_bgcolor='#FFFFFF',
        legend={
            'title': {'text': 'Detection Credibility'},
            'x': 1.02,
            'y': 1,
            'xanchor': 'left',
            'orientation': 'v',
            'font': {'size': 11}
        },
        margin={'l': 250, 'r': 100, 't': 100, 'b': 120}
    )

    # Add Control/Farm separator
    fig.add_vline(
        x=2.5,  # Between 3rd and 4th sample
        line_dash='dash',
        line_color='gray',
        line_width=1
    )

    # Add annotations
    fig.add_annotation(
        x=1, y=1.05,
        xref='x', yref='paper',
        text='Control Sites',
        showarrow=False,
        font=dict(size=12, color='gray')
    )

    fig.add_annotation(
        x=4, y=1.05,
        xref='x', yref='paper',
        text='Farm Sites',
        showarrow=False,
        font=dict(size=12, color='gray')
    )

    # Add bubble size reference annotation
    fig.add_annotation(
        x=0.02, y=-0.15,
        xref='paper', yref='paper',
        text='Bubble size = number of unique haplotypes (genetic variants)',
        showarrow=False,
        font=dict(size=10, color='gray'),
        xanchor='left'
    )

    # Add border legend annotation
    fig.add_annotation(
        x=0.02, y=-0.18,
        xref='paper', yref='paper',
        text='Border: Red (invasive species) | Orange (threatened species)',
        showarrow=False,
        font=dict(size=10, color='gray'),
        xanchor='left'
    )

    return fig

def main():
    # Define file path
    base_path = Path(r"g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA")
    input_file = base_path / "ALGA_EDNA_ALL_2507_Hapl.csv"

    # Create output directory
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    try:
        # Load data
        df = load_and_clean_data(str(input_file))

        # Select top species
        df_top = select_top_species(df, MAX_SPECIES_DISPLAY)

        # Transform to long format
        df_long = transform_to_long_format(df_top)

        # Create visualization
        fig = create_bubble_chart(df_long)

        # Export
        html_output = output_dir / 'haplotype-diversity.html'
        png_output = output_dir / 'haplotype-diversity.png'
        csv_output = output_dir / 'haplotype-data-summary.csv'

        print(f"\nExporting visualizations...")
        fig.write_html(str(html_output))
        print(f"[OK] HTML saved to: {html_output}")

        # Try PNG export (may fail if kaleido has issues)
        try:
            fig.write_image(str(png_output), width=1200, height=1000, scale=2)
            print(f"[OK] PNG saved to: {png_output}")
        except Exception as e:
            print(f"[WARNING] PNG export failed: {e}")
            print(f"[INFO] You can export PNG from the HTML file using your browser")

        # Export processed data
        df_long.to_csv(str(csv_output), index=False)
        print(f"[OK] Data summary saved to: {csv_output}")

        print("\n" + "="*60)
        print("HAPLOTYPE VISUALIZATION COMPLETE")
        print("="*60)
        print(f"[OK] Displayed {len(df_top)} species")
        print(f"[OK] Invasive species flagged: {df_top['is_invasive'].sum()}")
        print(f"[OK] Threatened species flagged: {df_top['is_threatened'].sum()}")

        # Print credibility distribution
        cred_dist = df_long['credibility'].value_counts()
        print(f"\nCredibility Distribution:")
        for cred, count in cred_dist.items():
            print(f"  - {cred}: {count} detections")

    except FileNotFoundError:
        print(f"ERROR: File not found: {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
