"""
Wrapper script to generate both taxonomy and haplotype visualizations
Skips PNG export to avoid kaleido hanging issues
"""
import pandas as pd
import plotly.graph_objects as go
from pathlib import Path
import sys

# Constants
SAMPLE_COLUMNS = ['ALGA_C_S', 'ALGA_C_W', 'ALGA_C_E', 'ALGA_F_L', 'ALGA_F_M', 'ALGA_F_AS']
PHYLUM_COLORS = {
    'Chromista': '#D4A574',
    'Metazoa': '#4A90E2',
    'Plantae': '#7CB342',
}
CREDIBILITY_COLORS = {
    'HIGH': '#4CAF50',
    'MODERATE': '#FFC107',
    'LOW': '#F44336'
}

def generate_taxonomy_viz(base_path):
    """Generate taxonomy stacked bar chart"""
    print("\n" + "="*60)
    print("GENERATING TAXONOMY VISUALIZATION")
    print("="*60)

    # Load data
    input_file = base_path / "ALGA_EDNA_ALL_2507_Taxo.csv"
    print(f"Loading: {input_file.name}")
    df = pd.read_csv(input_file)

    # Clean data
    df = df[df[SAMPLE_COLUMNS].notna().any(axis=1)]
    df = df[df['phylum'].notna() & (df['phylum'] != 'NA') & (df['phylum'] != '')]
    df = df.head(110)
    print(f"[OK] {len(df)} valid records")

    # Aggregate by phylum
    counts = {}
    for sample in SAMPLE_COLUMNS:
        phylum_counts = df.groupby('phylum')[sample].sum().to_dict()
        counts[sample] = {k: int(v) for k, v in phylum_counts.items()}

    # Convert to percentages
    percentages = {}
    for sample, phylum_dict in counts.items():
        total = sum(phylum_dict.values())
        percentages[sample] = {
            phylum: (count / total * 100) if total > 0 else 0
            for phylum, count in phylum_dict.items()
        }

    # Create figure
    fig = go.Figure()
    all_phyla = set()
    for sample_dict in percentages.values():
        all_phyla.update(sample_dict.keys())

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

    fig.update_layout(
        title='eDNA Phylum Composition: Control vs Farm Sites',
        xaxis_title='Sampling Location',
        yaxis_title='Relative Abundance (%)',
        barmode='stack',
        width=900,
        height=600,
        legend=dict(title='Phylum', x=1.02, y=1, xanchor='left', orientation='v')
    )

    fig.add_vline(x=2.5, line_dash='dash', line_color='gray', line_width=1)
    fig.add_annotation(x=1, y=1.08, xref='x', yref='paper', text='Control Sites', showarrow=False)
    fig.add_annotation(x=4, y=1.08, xref='x', yref='paper', text='Farm Sites', showarrow=False)

    # Export HTML only
    output_file = Path("output/taxonomy-composition.html")
    fig.write_html(str(output_file))
    print(f"[OK] Saved: {output_file}")

    return fig

def generate_haplotype_viz(base_path):
    """Generate haplotype bubble chart"""
    print("\n" + "="*60)
    print("GENERATING HAPLOTYPE VISUALIZATION")
    print("="*60)

    # Load data
    input_file = base_path / "ALGA_EDNA_ALL_2507_Hapl.csv"
    print(f"Loading: {input_file.name}")
    df = pd.read_csv(input_file)

    # Clean data
    df['species_name'] = df.iloc[:, 0]
    df = df[df[SAMPLE_COLUMNS].notna().any(axis=1)]
    df['total_haplotypes'] = df[SAMPLE_COLUMNS].sum(axis=1)
    df = df[df['total_haplotypes'] > 0]
    df['score'] = df['score'].fillna('MODERATE')
    df['NNS'] = df['NNS'].fillna('NA')
    df['is_invasive'] = (df['NNS'] != 'NA') & (df['NNS'].notna())

    print(f"[OK] {len(df)} species detected")

    # Select top 20 by diversity
    df_top = df.nlargest(20, 'total_haplotypes')

    # Transform to long format
    records = []
    for _, row in df_top.iterrows():
        for sample in SAMPLE_COLUMNS:
            count = int(row[sample])
            if count > 0:
                records.append({
                    'species': row['species_name'],
                    'sample': sample,
                    'haplotype_count': count,
                    'credibility': row['score'],
                    'phylum': row.get('phylum', 'Unknown'),
                    'is_invasive': row['is_invasive'],
                    'nns_name': row.get('NNS', 'NA'),
                    'total_diversity': row['total_haplotypes']
                })

    df_long = pd.DataFrame(records)
    print(f"[OK] {len(df_long)} data points")

    # Create figure
    fig = go.Figure()
    species_order = (df_long.groupby('species')['total_diversity']
                     .first().sort_values(ascending=False).index.tolist())

    for credibility in ['HIGH', 'MODERATE', 'LOW']:
        df_cred = df_long[df_long['credibility'] == credibility]
        if df_cred.empty:
            continue

        sizes = [8 + (count * 5) for count in df_cred['haplotype_count']]

        customdata = []
        for _, row in df_cred.iterrows():
            inv_text = f"🚨 Non-native: {row['nns_name']}" if row['is_invasive'] else ""
            customdata.append([row['species'], row['haplotype_count'], row['credibility'], row['phylum'], inv_text])

        fig.add_trace(go.Scatter(
            name=credibility,
            x=df_cred['sample'],
            y=df_cred['species'],
            mode='markers',
            marker=dict(size=sizes, color=CREDIBILITY_COLORS[credibility], opacity=0.7),
            customdata=customdata,
            hovertemplate=(
                '<b>%{customdata[0]}</b><br>'
                'Sample: %{x}<br>'
                'Haplotypes: %{customdata[1]}<br>'
                'Credibility: %{customdata[2]}<br>'
                'Phylum: %{customdata[3]}<br>'
                '%{customdata[4]}<br>'
                '<extra></extra>'
            )
        ))

    fig.update_layout(
        title='eDNA Haplotype Diversity and Detection Credibility',
        xaxis_title='Sampling Location',
        yaxis_title='Species (ranked by total haplotype diversity)',
        width=1000,
        height=800,
        plot_bgcolor='#FAFAFA',
        legend=dict(title='Detection Credibility', x=1.02, y=1, xanchor='left', orientation='v'),
        xaxis=dict(tickangle=-45, showgrid=True, gridcolor='#E0E0E0'),
        yaxis=dict(tickfont=dict(style='italic', size=10), showgrid=True, gridcolor='#E0E0E0',
                   categoryorder='array', categoryarray=species_order[::-1])
    )

    fig.add_vline(x=2.5, line_dash='dash', line_color='gray', line_width=1)
    fig.add_annotation(x=1, y=1.05, xref='x', yref='paper', text='Control Sites', showarrow=False)
    fig.add_annotation(x=4, y=1.05, xref='x', yref='paper', text='Farm Sites', showarrow=False)

    # Export HTML and CSV
    html_output = Path("output/haplotype-diversity.html")
    csv_output = Path("output/haplotype-data-summary.csv")

    fig.write_html(str(html_output))
    df_long.to_csv(str(csv_output), index=False)

    print(f"[OK] Saved: {html_output}")
    print(f"[OK] Saved: {csv_output}")

    return fig

def main():
    # Set up paths
    base_path = Path(r"g:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\02 - Colabs - PEBL\01 - SeaFarms\Algapelego\Nestle project\Annual reports\Data\EDNA")
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    try:
        # Generate both visualizations
        generate_taxonomy_viz(base_path)
        generate_haplotype_viz(base_path)

        print("\n" + "="*60)
        print("ALL VISUALIZATIONS COMPLETE!")
        print("="*60)
        print(f"\nOutput location: {output_dir.absolute()}")
        print("\nFiles generated:")
        print("  - taxonomy-composition.html (interactive)")
        print("  - haplotype-diversity.html (interactive)")
        print("  - haplotype-data-summary.csv (data export)")
        print("\nOpen the HTML files in your browser to view and export as PNG.")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
