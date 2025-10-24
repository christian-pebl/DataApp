import pandas as pd
import plotly.graph_objects as go
from typing import Dict
import sys
from pathlib import Path

# Constants
SAMPLE_COLUMNS = ['ALGA_C_S', 'ALGA_C_W', 'ALGA_C_E', 'ALGA_F_L', 'ALGA_F_M', 'ALGA_F_AS']
PHYLUM_COLORS = {
    'Chromista': '#D4A574',
    'Metazoa': '#4A90E2',
    'Plantae': '#7CB342',
    'Annelida': '#E57373',
    'Arthropoda': '#64B5F6',
    'Mollusca': '#9575CD',
    'Chordata': '#4DB6AC',
}

def load_and_clean_data(file_path: str) -> pd.DataFrame:
    """Load CSV and remove empty rows."""
    print(f"Loading data from: {file_path}")
    df = pd.read_csv(file_path)

    # Remove rows where all sample columns are empty/NaN
    df = df[df[SAMPLE_COLUMNS].notna().any(axis=1)]

    # Remove rows where phylum is NA or empty
    df = df[df['phylum'].notna() & (df['phylum'] != 'NA') & (df['phylum'] != '')]

    # Keep only first 110 rows (remove trailing empty rows)
    df = df.head(110)

    print(f"[OK] Loaded {len(df)} valid taxonomic records")
    return df

def aggregate_by_phylum(df: pd.DataFrame) -> Dict[str, Dict[str, int]]:
    """
    Returns: {
        'ALGA_C_S': {'Chromista': 12, 'Metazoa': 8},
        ...
    }
    """
    print("Aggregating data by phylum...")
    results = {}
    for sample in SAMPLE_COLUMNS:
        phylum_counts = df.groupby('phylum')[sample].sum().to_dict()
        # Convert to int for cleaner display
        phylum_counts = {k: int(v) for k, v in phylum_counts.items()}
        results[sample] = phylum_counts

    # Print summary
    for sample, counts in results.items():
        total = sum(counts.values())
        print(f"  {sample}: {total} total taxa across {len(counts)} phyla")

    return results

def convert_to_percentages(counts: Dict) -> Dict:
    """Convert raw counts to percentages."""
    print("Converting to percentages...")
    percentages = {}
    for sample, phylum_dict in counts.items():
        total = sum(phylum_dict.values())
        percentages[sample] = {
            phylum: (count / total * 100) if total > 0 else 0
            for phylum, count in phylum_dict.items()
        }
    return percentages

def create_stacked_bar_chart(percentages: Dict, counts: Dict) -> go.Figure:
    """Generate Plotly figure."""
    print("Creating stacked bar chart...")
    fig = go.Figure()

    # Get all unique phyla
    all_phyla = set()
    for sample_dict in percentages.values():
        all_phyla.update(sample_dict.keys())

    print(f"Found {len(all_phyla)} unique phyla: {sorted(all_phyla)}")

    # Create trace for each phylum (sorted for consistency)
    for phylum in sorted(all_phyla):
        y_values = [percentages[sample].get(phylum, 0) for sample in SAMPLE_COLUMNS]
        count_values = [counts[sample].get(phylum, 0) for sample in SAMPLE_COLUMNS]

        fig.add_trace(go.Bar(
            name=phylum,
            x=SAMPLE_COLUMNS,
            y=y_values,
            marker_color=PHYLUM_COLORS.get(phylum, '#CCCCCC'),
            customdata=[[c] for c in count_values],
            hovertemplate=(
                '<b>%{fullData.name}</b><br>'
                'Site: %{x}<br>'
                'Taxa Count: %{customdata[0]}<br>'
                'Percentage: %{y:.1f}%<br>'
                '<extra></extra>'
            )
        ))

    # Update layout
    fig.update_layout(
        title={
            'text': 'eDNA Phylum Composition: Control vs Farm Sites',
            'font': {'size': 18, 'family': 'Arial, sans-serif'}
        },
        xaxis={
            'title': 'Sampling Location',
            'tickangle': -45,
            'tickfont': {'size': 12},
            'categoryorder': 'array',
            'categoryarray': SAMPLE_COLUMNS
        },
        yaxis={
            'title': 'Relative Abundance (%)',
            'tickformat': '.0f',
            'range': [0, 100]
        },
        barmode='stack',
        bargap=0.15,
        showlegend=True,
        legend={
            'title': {'text': 'Phylum'},
            'x': 1.02,
            'y': 1,
            'xanchor': 'left',
            'orientation': 'v'
        },
        hovermode='closest',
        width=900,
        height=600,
        margin={'l': 80, 'r': 150, 't': 100, 'b': 120}
    )

    # Add vertical separator line between Control and Farm
    fig.add_shape(
        type='line',
        x0=2.5, y0=0,
        x1=2.5, y1=100,
        line=dict(color='gray', width=1, dash='dash'),
        yref='y', xref='x'
    )

    # Add Control Sites annotation
    fig.add_annotation(
        x=1, y=1.08,
        xref='x', yref='paper',
        text='Control Sites',
        showarrow=False,
        font=dict(size=12, color='gray')
    )

    # Add Farm Sites annotation
    fig.add_annotation(
        x=4, y=1.08,
        xref='x', yref='paper',
        text='Farm Sites',
        showarrow=False,
        font=dict(size=12, color='gray')
    )

    # Add taxa richness annotations above each bar
    for i, sample in enumerate(SAMPLE_COLUMNS):
        total_taxa = sum(counts[sample].values())
        fig.add_annotation(
            x=i, y=105,
            xref='x', yref='y',
            text=f'n={total_taxa}',
            showarrow=False,
            font=dict(size=10, color='black')
        )

    return fig

def main():
    # Define file path
    base_path = Path(r"g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA")
    input_file = base_path / "ALGA_EDNA_ALL_2507_Taxo.csv"

    # Create output directory
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    try:
        # Load data
        df = load_and_clean_data(str(input_file))

        # Process
        counts = aggregate_by_phylum(df)
        percentages = convert_to_percentages(counts)

        # Visualize
        fig = create_stacked_bar_chart(percentages, counts)

        # Export
        html_output = output_dir / 'taxonomy-composition.html'
        png_output = output_dir / 'taxonomy-composition.png'

        print(f"\nExporting visualizations...")
        fig.write_html(str(html_output))
        print(f"[OK] HTML saved to: {html_output}")

        # Try PNG export (may fail if kaleido has issues)
        try:
            fig.write_image(str(png_output), width=1200, height=800, scale=2)
            print(f"[OK] PNG saved to: {png_output}")
        except Exception as e:
            print(f"[WARNING] PNG export failed: {e}")
            print(f"[INFO] You can export PNG from the HTML file using your browser")

        print("\n" + "="*60)
        print("TAXONOMY VISUALIZATION COMPLETE")
        print("="*60)

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
